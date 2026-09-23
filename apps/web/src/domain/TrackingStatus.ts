/**
 * A relação da pessoa com a série — não é o estado da produção. "Concluída" aqui quer dizer
 * "terminei", e a série pode muito bem ganhar temporada nova depois.
 */
export const TRACKING_STATUSES = ['Following', 'ForLater', 'Finished', 'Archived'] as const

export type TrackingStatus = (typeof TRACKING_STATUSES)[number]

/** O detalhe devolve "Untracked" para série do catálogo que a pessoa não acompanha. */
export type SeriesRelation = TrackingStatus | 'Untracked'

interface StatusCopy {
  label: string
  plural: string
  hint: string
}

/** A situação da PRODUÇÃO, como o TMDB a descreve, em português. */
export class ProductionStatusInfo {
  private static readonly labels: Record<string, string> = {
    'Returning Series': 'Em produção',
    'In Production': 'Em produção',
    Planned: 'Anunciada',
    Pilot: 'Piloto',
    Ended: 'Encerrada',
    Canceled: 'Cancelada',
  }

  static label(status: string | null): string | null {
    if (!status) return null
    return ProductionStatusInfo.labels[status] ?? status
  }
}

export class TrackingStatusInfo {
  private static readonly copy: Record<SeriesRelation, StatusCopy> = {
    Following: {
      label: 'Assistindo',
      plural: 'Assistindo',
      hint: 'Aparece em Agora e na agenda de estreias.',
    },
    ForLater: {
      label: 'Para depois',
      plural: 'Para depois',
      hint: 'Guardada para começar ou retomar mais tarde.',
    },
    Finished: {
      label: 'Concluída',
      plural: 'Concluídas',
      hint: 'Você terminou. Sai da agenda, fica no histórico.',
    },
    Archived: {
      label: 'Arquivada',
      plural: 'Arquivadas',
      hint: 'Parou de acompanhar. Nada é apagado.',
    },
    Untracked: {
      label: 'Fora do acervo',
      plural: 'Fora do acervo',
      hint: 'Você ainda não acompanha esta série.',
    },
  }

  static isTracking(value: string): value is TrackingStatus {
    return (TRACKING_STATUSES as readonly string[]).includes(value)
  }

  static relation(value: string): SeriesRelation {
    return TrackingStatusInfo.isTracking(value) ? value : 'Untracked'
  }

  static label(value: string): string {
    return TrackingStatusInfo.copy[TrackingStatusInfo.relation(value)].label
  }

  static plural(value: string): string {
    return TrackingStatusInfo.copy[TrackingStatusInfo.relation(value)].plural
  }

  static hint(value: string): string {
    return TrackingStatusInfo.copy[TrackingStatusInfo.relation(value)].hint
  }
}
