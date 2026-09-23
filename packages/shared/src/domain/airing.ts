import { formatWhen } from './format.ts';

/**
 * O que já foi ao ar, e o que ainda vai.
 *
 * <b>Por que existe.</b> Dava para marcar como assistido um episódio que estreia em novembro. O
 * servidor agora recusa, mas recusa é a última linha de defesa: um botão que a pessoa aperta e
 * recebe erro é um botão que não devia estar ali. Esta classe é o que permite aos dois clientes
 * esconderem a ação antes de ela ser oferecida — com a MESMA regra do servidor, incluindo o
 * detalhe que mais escorrega, que é o de data ausente contar como exibida.
 *
 * <b>Duas perguntas, duas regras.</b> "Posso marcar?" e "já estreou?" parecem a mesma coisa e não
 * são:
 *
 * - {@link hasAired} responde a primeira, pela DATA, e é permissiva de propósito — liberar o botão
 *   cedo custa um clique desfeito, travá-lo tarde impede alguém de registrar o que acabou de ver.
 * - {@link hasReleased} responde a segunda, pelo INSTANTE que o servidor calcula (`releasesAt`),
 *   e é conservadora: nunca diz "estreou" antes de ter estreado.
 *
 * Elas discordam justamente onde o app estava errado. Silo T3E10 tem `air_date` 03/09 no
 * calendário americano; à 00h01 de quinta no Brasil a primeira já diz "sim" (e tudo bem, é só o
 * botão), enquanto a segunda diz "não" até as 5h de sexta — que é quando o episódio de fato chega
 * aqui. Antes só existia a primeira, e a tela dizia "Estreou hoje" para algo que só sairia no dia
 * seguinte.
 */
export class Airing {
  /**
   * Já estreou? — a pergunta do BOTÃO de marcar, respondida pela data.
   *
   * <b>Data ausente conta como exibida.</b> São 391 episódios do acervo sem data — antigos e
   * especiais que o TMDB nunca datou. Bloqueá-los impediria alguém de registrar o que de fato
   * assistiu, e esse é o erro caro: o log de exibições é a fonte da verdade do app, então recusar
   * um evento verdadeiro corrompe o dado, enquanto aceitar um duvidoso só o deixa lá para ser
   * desmarcado.
   */
  static hasAired(airDate: string | null | undefined, now: Date = new Date()): boolean {
    const dia = Airing.toLocalDay(airDate);
    return dia === null || dia <= Airing.startOfLocalDay(now);
  }

  /**
   * Já saiu de verdade? — a pergunta da TELA, respondida pelo instante.
   *
   * `releasesAt` vem pronto do servidor (ver `ReleaseSchedule` no domínio da API): é o fim do dia
   * da estreia no fuso de ORIGEM da série. Aqui só se compara com o relógio de quem está olhando.
   * Sem o campo — DTO antigo, ou episódio sem data —, cai em {@link hasAired}, que é o
   * comportamento que existia antes.
   */
  static hasReleased(
    releasesAt: string | null | undefined,
    airDate: string | null | undefined,
    now: Date = new Date()
  ): boolean {
    if (!releasesAt) return Airing.hasAired(airDate, now);

    const quando = new Date(releasesAt);
    return Number.isNaN(quando.getTime()) ? Airing.hasAired(airDate, now) : now >= quando;
  }

  /**
   * "estreia amanhã", "estreia hoje", "estreou ontem" — ou nada, se não há data.
   *
   * <b>O dia sai do instante, não da `air_date`.</b> É o que faz o rótulo falar do calendário de
   * quem lê: a estreia americana de quinta vira sexta de madrugada no Brasil, e o app diz
   * "Estreia amanhã" porque é isso que a pessoa vai viver. Usar a `air_date` crua diria "hoje" —
   * o dia certo em Los Angeles, o dia errado aqui.
   *
   * Reaproveita {@link formatWhen}, que já sabe falar de dias no futuro e traz a preposição
   * quando ela é necessária. Escrever outro formatador daria ao mesmo dado duas vozes na mesma
   * tela.
   */
  static label(
    airDate: string | null | undefined,
    now: Date = new Date(),
    releasesAt?: string | null
  ): string | null {
    const estreou = Airing.hasReleased(releasesAt, airDate, now);

    // O instante manda quando existe; sem ele, o meio-dia UTC da air_date (ver toIso).
    const quando = Airing.referencia(releasesAt) ?? Airing.toIso(airDate);
    if (quando === null) return null;

    return `${estreou ? 'Estreou' : 'Estreia'} ${formatWhen(quando, now)}`;
  }

  /** O instante de referência do rótulo, quando o servidor mandou um. */
  private static referencia(releasesAt: string | null | undefined): string | null {
    if (!releasesAt) return null;
    const d = new Date(releasesAt);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  /**
   * Meio-dia UTC do dia informado.
   *
   * A data de exibição não tem hora. Ancorá-la ao meio-dia faz qualquer fuso das Américas ou da
   * Europa cair no mesmo dia do calendário — à meia-noite, um fuso negativo jogaria a estreia para
   * o dia anterior.
   */
  private static toIso(airDate: string | null | undefined): string | null {
    if (!airDate) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(airDate) ? `${airDate}T12:00:00Z` : null;
  }

  private static toLocalDay(airDate: string | null | undefined): number | null {
    if (!airDate) return null;
    const iso = Airing.toIso(airDate);
    if (iso === null) return null;

    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return null;
    return Airing.startOfLocalDay(data);
  }

  private static startOfLocalDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
}
