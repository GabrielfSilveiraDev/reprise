/**
 * Como a tela inicial se organiza.
 *
 * <b>O problema que este módulo resolve.</b> "Próximos" listava 49 séries em linhas idênticas,
 * ordenadas por atividade — mas 47 delas tinham a mesma atividade, a data da importação. Na
 * prática, a tela dizia "você tem 49 pendências" e não dizia qual retomar. Uma tela cuja única
 * pergunta é "o que assisto agora?" tem de responder isso, e não apresentar um inventário.
 *
 * <b>A separação.</b> Duas prateleiras: o que você está de fato assistindo e o que está em pausa.
 * O corte é por recência, porque é isso que a pessoa quer dizer com "estou assistindo" — e não por
 * `is_backfill`, que parece o critério certo e não é: metade das marcações individuais do TV Time
 * também caiu na data da importação, então elas passariam por "atividade real" sem ser.
 *
 * <b>"Em pausa", e não "guardadas".</b> Guardar é um ato deliberado — e já existe, com esse
 * sentido, no estado <c>ForLater</c> ("Para depois"), que é a série que você separou sem nunca ter
 * começado. Esta prateleira é o contrário: você COMEÇOU e parou. Chamar as duas de "guardada"
 * fundia dois estados opostos sob a mesma palavra, e quem lia a tela não tinha como saber qual dos
 * dois estava vendo.
 *
 * <b>Por que aqui.</b> Web e app precisam agrupar igual e chamar cada grupo pelo mesmo nome. Duas
 * implementações dariam duas telas iniciais diferentes para os mesmos dados, que é a divergência
 * que este pacote existe para impedir.
 */

/** O bastante de um item de "próximos" para agrupá-lo. Os clientes passam o DTO inteiro. */
export interface ShelfItemLike {
  readonly lastActivityAt: string | null | undefined;
}

/** O bastante de uma estreia para decidir se ela aparece. Os clientes passam o DTO inteiro. */
export interface PremiereLike {
  readonly seriesId: number;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  /** `YYYY-MM-DD`. */
  readonly airDate: string;
  /** Sinopse do episódio. Sem ela a estreia não entra — ver {@link HomeShelf.upcomingPremieres}. */
  readonly overview?: string | null;
  /** Sua exibição mais recente na série: é o que diz se você a está assistindo. */
  readonly lastActivityAt?: string | null;
}

/**
 * <b>60 dias.</b> Não é um número mágico e sim um limite de memória: passado mais ou menos dois
 * meses, ninguém lembra onde parou sem reabrir a série — a diferença entre "continuar" e
 * "recomeçar". Abaixo disso a série ainda está viva na cabeça de quem assiste.
 */
const DIAS_EM_ANDAMENTO = 60;

/**
 * <b>45 dias de estreias</b> — para as séries que você acompanha mas não está assistindo. A tela
 * abria com episódios de novembro do ano seguinte, o que empurra o que dá para assistir hoje para
 * baixo da dobra: a estreia de uma série parada só é notícia quando está perto o bastante para
 * mudar o que você faz nesta semana. A da série em andamento é notícia a qualquer distância.
 */
const DIAS_DE_ESTREIA = 45;

export interface HomeShelves<T> {
  /** O que você está assistindo. Vem primeiro e ganha o espaço. */
  readonly emAndamento: readonly T[];
  /** O que você começou e parou. Existe, não cobra. */
  readonly emPausa: readonly T[];
}

export class HomeShelf {
  /**
   * "Boa noite" — pela hora do aparelho.
   *
   * Cumprimentar é a parte barata de parecer acolhedor, mas só funciona se estiver certo: dar
   * "bom dia" às onze da noite é pior do que não cumprimentar. Daí sair da hora local, e não de
   * um horário fixo do servidor.
   */
  static greeting(now: Date = new Date()): string {
    const hora = now.getHours();
    if (hora < 5) return 'Boa madrugada';
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  /** Divide a fila entre o que está em andamento e o que está em pausa. */
  static split<T extends ShelfItemLike>(items: readonly T[], now: Date = new Date()): HomeShelves<T> {
    const emAndamento: T[] = [];
    const emPausa: T[] = [];

    for (const item of items) {
      (HomeShelf.isAtiva(item.lastActivityAt, now) ? emAndamento : emPausa).push(item);
    }

    return { emAndamento, emPausa };
  }

  /** Está assistindo? — o mesmo corte para as prateleiras e para a distância das estreias. */
  private static isAtiva(lastActivityAt: string | null | undefined, now: Date): boolean {
    if (!lastActivityAt) return false;
    const quando = new Date(lastActivityAt);
    if (Number.isNaN(quando.getTime())) return false;

    const dias = (now.getTime() - quando.getTime()) / 86_400_000;
    // Data no futuro conta como ativa: é relógio torto ou fuso, nunca "abandonada".
    return dias <= DIAS_EM_ANDAMENTO;
  }

  /**
   * A frase que orienta, logo abaixo do cumprimento.
   *
   * Fala do que existe, nunca do que falta: "47 esperando" lido como dívida é o oposto do que uma
   * tela inicial deveria provocar em quem só quer escolher um episódio.
   */
  static summary(emAndamento: number, emPausa: number): string {
    if (emAndamento === 0 && emPausa === 0) {
      return 'Nada em aberto. Toda série que você acompanha está em dia.';
    }

    if (emAndamento === 0) {
      return emPausa === 1
        ? 'Uma série em pausa, esperando a hora que você quiser.'
        : `${emPausa} séries em pausa, esperando a hora que você quiser.`;
    }

    const inicio =
      emAndamento === 1 ? 'Uma série em andamento' : `${emAndamento} séries em andamento`;

    if (emPausa === 0) return `${inicio}. É só continuar de onde parou.`;
    return emPausa === 1
      ? `${inicio}, e mais uma em pausa para quando der vontade.`
      : `${inicio}, e outras ${emPausa} em pausa para quando der vontade.`;
  }

  /**
   * As estreias da tela inicial: o próximo episódio de cada série, quando já dá para dizer algo
   * sobre ele. Do mais próximo ao mais distante.
   *
   * <b>Um por série.</b> A faixa mostrava cada episódio até o fim do horizonte, e uma série semanal
   * a ocupava inteira — seis cartões de Dark Matter e nenhum de outra série. O que se quer saber é
   * quando sai o PRÓXIMO de cada uma; o seguinte aparece quando este for ao ar.
   *
   * <b>A distância depende de você estar assistindo.</b> Série em andamento (exibição nos últimos
   * {@link DIAS_EM_ANDAMENTO} dias, o mesmo corte das prateleiras) aparece a qualquer distância: a
   * volta de Silo daqui a dez meses é notícia para quem acabou de terminar a temporada anterior.
   * As demais séries acompanhadas, só quando a estreia está a até {@link DIAS_DE_ESTREIA} dias.
   *
   * <b>Só com data e resumo.</b> Um cartão com "Episódio 1" e nada mais não diz nada — e é o que
   * existe para quase toda estreia distante. Se o próximo episódio ainda não tem resumo, a série
   * sai da faixa em vez de ceder o lugar ao episódio seguinte: mostrar o 6 enquanto o 5 não saiu
   * seria mentir sobre qual é o próximo.
   *
   * Também descarta o que já foi ao ar: o episódio que estreou ontem não é estreia, é pendência —
   * e aparece sozinho na lista de "próximos" assim que a sincronização passar.
   */
  static upcomingPremieres<T extends PremiereLike>(
    premieres: readonly T[],
    now: Date = new Date(),
  ): readonly T[] {
    const hoje = HomeShelf.startOfLocalDay(now);
    const limite = hoje + DIAS_DE_ESTREIA * 86_400_000;

    // Primeiro o próximo de cada série, e só depois os filtros — é a ordem que impede o episódio
    // seguinte de ocupar o lugar de um próximo que não tem resumo.
    const proximos = new Map<number, { premiere: T; quando: number }>();
    for (const p of premieres) {
      const quando = HomeShelf.diaDaEstreia(p.airDate);
      if (quando === null || quando < hoje) continue;

      const atual = proximos.get(p.seriesId);
      if (!atual || HomeShelf.vemAntes(p, quando, atual.premiere, atual.quando)) {
        proximos.set(p.seriesId, { premiere: p, quando });
      }
    }

    return [...proximos.values()]
      .filter(
        ({ premiere, quando }) =>
          HomeShelf.temResumo(premiere) &&
          (quando <= limite || HomeShelf.isAtiva(premiere.lastActivityAt, now)),
      )
      .sort((a, b) => a.quando - b.quando)
      .map(({ premiere }) => premiere);
  }

  /**
   * Meio-dia UTC da data: a data de exibição não tem hora, e qualquer fuso do Brasil ou da Europa
   * cai no mesmo dia do calendário a partir daí.
   */
  private static diaDaEstreia(airDate: string): number | null {
    const quando = new Date(`${airDate}T12:00:00Z`).getTime();
    return Number.isNaN(quando) ? null : quando;
  }

  /** Ordem de exibição: a data primeiro; no mesmo dia (estreia dupla), o menor episódio. */
  private static vemAntes(
    a: PremiereLike,
    quandoA: number,
    b: PremiereLike,
    quandoB: number,
  ): boolean {
    if (quandoA !== quandoB) return quandoA < quandoB;
    if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber < b.seasonNumber;
    return a.episodeNumber < b.episodeNumber;
  }

  /** Resumo em branco é o mesmo que nenhum: não há o que ler no cartão. */
  private static temResumo(p: PremiereLike): boolean {
    return typeof p.overview === 'string' && p.overview.trim().length > 0;
  }

  private static startOfLocalDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
}
