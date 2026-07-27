import { formatWhen } from './format.ts';

/**
 * O que já foi ao ar, e o que ainda vai.
 *
 * <b>Por que existe.</b> Dava para marcar como assistido um episódio que estreia em novembro. O
 * servidor agora recusa, mas recusa é a última linha de defesa: um botão que a pessoa aperta e
 * recebe erro é um botão que não devia estar ali. Esta classe é o que permite aos dois clientes
 * esconderem a ação antes de ela ser oferecida — com a MESMA regra do servidor, incluindo o
 * detalhe que mais escorrega, que é o de data ausente contar como exibida.
 */
export class Airing {
  /**
   * Já estreou?
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
   * "estreia amanhã", "estreia em 12 dias", "estreou ontem" — ou nada, se não há data.
   *
   * Reaproveita {@link formatWhen}, que já sabe falar de dias no futuro e traz a preposição
   * quando ela é necessária. Escrever outro formatador daria ao mesmo dado duas vozes na mesma
   * tela.
   */
  static label(airDate: string | null | undefined, now: Date = new Date()): string | null {
    if (!airDate) return null;
    const quando = Airing.toIso(airDate);
    if (quando === null) return null;

    const verbo = Airing.hasAired(airDate, now) ? 'Estreou' : 'Estreia';
    return `${verbo} ${formatWhen(quando, now)}`;
  }

  /**
   * Meio-dia UTC do dia informado.
   *
   * A data de exibição não tem hora. Ancorá-la ao meio-dia faz qualquer fuso das Américas ou da
   * Europa cair no mesmo dia do calendário — à meia-noite, um fuso negativo jogaria a estreia para
   * o dia anterior.
   */
  private static toIso(airDate: string): string | null {
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
