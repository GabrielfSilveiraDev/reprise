/**
 * Como a tela inicial se organiza.
 *
 * <b>O problema que este módulo resolve.</b> "Próximos" listava 49 séries em linhas idênticas,
 * ordenadas por atividade — mas 47 delas tinham a mesma atividade, a data da importação. Na
 * prática, a tela dizia "você tem 49 pendências" e não dizia qual retomar. Uma tela cuja única
 * pergunta é "o que assisto agora?" tem de responder isso, e não apresentar um inventário.
 *
 * <b>A separação.</b> Duas prateleiras: o que você está de fato assistindo e o que está guardado.
 * O corte é por recência, porque é isso que a pessoa quer dizer com "estou assistindo" — e não por
 * `is_backfill`, que parece o critério certo e não é: metade das marcações individuais do TV Time
 * também caiu na data da importação, então elas passariam por "atividade real" sem ser.
 *
 * <b>Por que aqui.</b> Web e app precisam agrupar igual e chamar cada grupo pelo mesmo nome. Duas
 * implementações dariam duas telas iniciais diferentes para os mesmos dados, que é a divergência
 * que este pacote existe para impedir.
 */

/** O bastante de um item de "próximos" para agrupá-lo. Os clientes passam o DTO inteiro. */
export interface ShelfItemLike {
  readonly lastActivityAt: string | null | undefined;
}

/** O bastante de uma estreia para saber se ela ainda interessa hoje. */
export interface PremiereLike {
  /** `YYYY-MM-DD`. */
  readonly airDate: string;
}

/**
 * <b>60 dias.</b> Não é um número mágico e sim um limite de memória: passado mais ou menos dois
 * meses, ninguém lembra onde parou sem reabrir a série — a diferença entre "continuar" e
 * "recomeçar". Abaixo disso a série ainda está viva na cabeça de quem assiste.
 */
const DIAS_EM_ANDAMENTO = 60;

/**
 * <b>45 dias de estreias.</b> A tela abria com episódios de novembro do ano seguinte, o que empurra
 * o que dá para assistir hoje para baixo da dobra. Estreia só é notícia quando está perto o
 * bastante para mudar o que você faz nesta semana.
 */
const DIAS_DE_ESTREIA = 45;

export interface HomeShelves<T> {
  /** O que você está assistindo. Vem primeiro e ganha o espaço. */
  readonly emAndamento: readonly T[];
  /** O que está guardado. Existe, não cobra. */
  readonly guardadas: readonly T[];
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

  /** Divide a fila entre o que está em andamento e o que está guardado. */
  static split<T extends ShelfItemLike>(items: readonly T[], now: Date = new Date()): HomeShelves<T> {
    const emAndamento: T[] = [];
    const guardadas: T[] = [];

    for (const item of items) {
      (HomeShelf.isAtiva(item, now) ? emAndamento : guardadas).push(item);
    }

    return { emAndamento, guardadas };
  }

  private static isAtiva(item: ShelfItemLike, now: Date): boolean {
    if (!item.lastActivityAt) return false;
    const quando = new Date(item.lastActivityAt);
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
  static summary(emAndamento: number, guardadas: number): string {
    if (emAndamento === 0 && guardadas === 0) {
      return 'Nada em aberto. Toda série que você acompanha está em dia.';
    }

    if (emAndamento === 0) {
      return guardadas === 1
        ? 'Uma série guardada, esperando a hora que você quiser.'
        : `${guardadas} séries guardadas, esperando a hora que você quiser.`;
    }

    const inicio =
      emAndamento === 1 ? 'Uma série em andamento' : `${emAndamento} séries em andamento`;

    if (guardadas === 0) return `${inicio}. É só continuar de onde parou.`;
    return guardadas === 1
      ? `${inicio}, e mais uma guardada para quando der vontade.`
      : `${inicio}, e outras ${guardadas} guardadas para quando der vontade.`;
  }

  /**
   * Só as estreias próximas o bastante para importar.
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

    return premieres.filter((p) => {
      // Meio-dia UTC: a data de exibição não tem hora, e qualquer fuso do Brasil ou da Europa cai
      // no mesmo dia do calendário a partir daí.
      const quando = new Date(`${p.airDate}T12:00:00Z`).getTime();
      return !Number.isNaN(quando) && quando >= hoje && quando <= limite;
    });
  }

  private static startOfLocalDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
}
