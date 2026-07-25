/**
 * Decide QUAIS avisos de estreia agendar e QUANDO.
 *
 * Puro de propósito: a parte que erra num agendamento é a aritmética de data e a regra de
 * duplicidade, não a chamada ao sistema operacional. Aqui isso é testável sem aparelho.
 */

export interface ReminderInput {
  readonly episodeId: number;
  readonly seriesName: string;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly episodeName?: string | null;
  /** `YYYY-MM-DD`, como a API entrega. */
  readonly airDate: string;
  readonly isSeasonPremiere: boolean;
}

export interface Reminder {
  /** Estável por episódio — é o que impede agendar o mesmo aviso duas vezes. */
  readonly key: string;
  readonly episodeId: number;
  readonly title: string;
  readonly body: string;
  readonly fireAt: Date;
}

export class PremiereReminders {
  /**
   * Hora local do aviso. Não é meia-noite: um aviso às 00:00 chega quando o episódio ainda não
   * está disponível em lugar nenhum e a pessoa está dormindo. 19h é quando se assiste série.
   */
  static readonly DefaultHour = 19;

  /**
   * Monta os avisos a agendar.
   *
   * @param now o instante de referência — parâmetro, e não `new Date()` interno, para que o
   *   comportamento na virada do dia seja testável em vez de depender de quando a suíte roda.
   * @param alreadyScheduled chaves já agendadas; reagendar o mesmo episódio geraria aviso
   *   duplicado a cada abertura do app.
   */
  static plan(
    premieres: readonly ReminderInput[],
    now: Date,
    alreadyScheduled: readonly string[] = [],
    hour = PremiereReminders.DefaultHour,
  ): Reminder[] {
    const known = new Set(alreadyScheduled);

    return premieres
      .map((p) => PremiereReminders.build(p, hour))
      .filter((r): r is Reminder => r !== null)
      // Passado não se agenda. Acontece de verdade: a data vem do TMDB e o app pode abrir dias
      // depois, com estreias que já ocorreram ainda na lista.
      .filter((r) => r.fireAt.getTime() > now.getTime())
      .filter((r) => !known.has(r.key));
  }

  static keyFor(episodeId: number): string {
    return `premiere:${episodeId}`;
  }

  private static build(p: ReminderInput, hour: number): Reminder | null {
    const parts = p.airDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;

    const [year, month, day] = parts as [number, number, number];
    // Construído em horário LOCAL: o aviso deve chegar às 19h de quem carrega o telefone, não
    // às 19h UTC.
    const fireAt = new Date(year, month - 1, day, hour, 0, 0, 0);
    if (Number.isNaN(fireAt.getTime())) return null;

    return {
      key: PremiereReminders.keyFor(p.episodeId),
      episodeId: p.episodeId,
      title: p.isSeasonPremiere
        ? `${p.seriesName}: temporada ${p.seasonNumber} estreia hoje`
        : `${p.seriesName}: episódio novo hoje`,
      body: PremiereReminders.bodyFor(p),
      fireAt,
    };
  }

  private static bodyFor(p: ReminderInput): string {
    const code = p.seasonNumber === 0 ? `Especial ${p.episodeNumber}` : `T${p.seasonNumber}E${p.episodeNumber}`;
    return p.episodeName ? `${code} — ${p.episodeName}` : code;
  }
}
