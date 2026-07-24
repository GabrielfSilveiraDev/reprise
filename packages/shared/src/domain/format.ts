/**
 * Formatação compartilhada entre web e mobile. Tudo em pt-BR e com números que
 * possam ser lidos em coluna — o design pede numerais tabulares e alinhamento.
 */

/** `5400` → `"1 h 30 min"`. Segundos, porque é a unidade que o export e o banco usam. */
export function formatRuntime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/** Tempo total acumulado, na escala de quem assistiu centenas de horas. */
export function formatTotalTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const hours = Math.round(seconds / 3600);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

export function formatEpisodeCode(seasonNumber: number, episodeNumber: number): string {
  return seasonNumber === 0 ? `Especial ${episodeNumber}` : `T${seasonNumber}E${episodeNumber}`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

const RELATIVE = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const ABSOLUTE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Datas recentes em linguagem relativa, o resto em data absoluta. O corte em 30 dias
 * existe porque "há 8 meses" é menos informativo do que "12 de nov. de 2025".
 */
export function formatWatchedAt(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'nunca';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'nunca';

  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  if (Math.abs(days) < 30) {
    return days === 0 ? 'hoje' : RELATIVE.format(days, 'day');
  }
  return ABSOLUTE.format(date);
}

/**
 * Estado de exibição por extenso, para leitor de tela e rótulos.
 * Existe aqui, e não em cada componente, porque a concordância de "1 vez" / "2 vezes"
 * já escapou uma vez — e web e Android precisam dizer a mesma coisa.
 */
export function formatWatchCount(count: number): string {
  if (count <= 0) return 'não assistido';
  return count === 1 ? 'assistido 1 vez' : `assistido ${count} vezes`;
}

/** Rótulo em pt-BR para o estado da série. */
export function formatSeriesStatus(status: string): string {
  switch (status) {
    case 'Following':
      return 'Acompanhando';
    case 'Archived':
      return 'Arquivada';
    case 'ForLater':
      return 'Para depois';
    case 'Finished':
      return 'Concluída';
    default:
      return status;
  }
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/** Monta a URL do pôster. `posterPath` vem do TMDB já com a barra inicial. */
export function posterUrl(
  posterPath: string | null | undefined,
  size: 'w154' | 'w342' | 'w500' = 'w342',
): string | null {
  return posterPath ? `${TMDB_IMAGE_BASE}/${size}${posterPath}` : null;
}
