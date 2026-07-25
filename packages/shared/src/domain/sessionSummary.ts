/**
 * Como uma sessão de rewatch se descreve em uma linha.
 *
 * Vive no pacote compartilhado porque a frase precisa ser idêntica nos dois clientes: "3ª vez ·
 * 12 dias · 24 episódios" tem de significar a mesma coisa no telefone e no navegador. Deixar cada
 * tela montar a sua daria duas redações do mesmo dado — que é como as divergências começam.
 */

export interface SessionLike {
  readonly ordinal: number;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly exhibitions: number;
  readonly distinctEpisodes: number;
  readonly spanDays: number;
}

export class SessionSummary {
  /** "1ª vez", "2ª vez"… O ordinal feminino concorda com "vez" e não com "episódio". */
  static ordinalLabel(ordinal: number): string {
    return `${ordinal}ª vez`;
  }

  /**
   * "12 dias · 24 episódios · 26 exibições".
   *
   * As exibições só aparecem quando passam dos episódios distintos — dizer "24 episódios · 24
   * exibições" é repetir o mesmo número com dois nomes. Quando passam, a diferença É a notícia:
   * significa que você reviu episódios dentro da própria passada.
   */
  static detail(session: SessionLike): string {
    const partes = [
      session.spanDays === 1 ? 'em um dia' : `${session.spanDays} dias`,
      `${session.distinctEpisodes} ${session.distinctEpisodes === 1 ? 'episódio' : 'episódios'}`,
    ];

    if (session.exhibitions > session.distinctEpisodes) {
      partes.push(`${session.exhibitions} exibições`);
    }

    return partes.join(' · ');
  }

  /**
   * O aviso de que as marcações em massa ficaram de fora, ou `null` quando não há o que declarar.
   *
   * Uma sessão é uma afirmação sobre QUANDO, e o backfill do TV Time carrega a data da importação,
   * não a da exibição. Incluí-lo produziria uma passada gigante e falsa. Esconder sem dizer seria
   * pior: a tela mostraria "1 vez" para quem assistiu dezessete.
   */
  static hiddenNotice(backfillExhibitions: number): string | null {
    if (backfillExhibitions <= 0) return null;
    return `${backfillExhibitions.toLocaleString('pt-BR')} exibições importadas do TV Time não entram aqui: todas carregam a data da importação, não a de quando você assistiu.`;
  }
}
