/**
 * URLs de imagem do TMDB. A API guarda só o caminho ("/abc.jpg"); o tamanho é escolha de quem
 * desenha, e errar para cima custa banda à toa — um pôster de 92px não precisa do original.
 */
export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780'
export type StillSize = 'w185' | 'w300' | 'original'

export class TmdbImage {
  static readonly BASE = 'https://image.tmdb.org/t/p'

  private static readonly posterWidths: Record<PosterSize, number> = {
    w92: 92,
    w154: 154,
    w185: 185,
    w342: 342,
    w500: 500,
    w780: 780,
  }

  static url(path: string | null | undefined, size: PosterSize | StillSize): string | null {
    return path ? `${TmdbImage.BASE}/${size}${path}` : null
  }

  /** srcset de pôster a partir de um tamanho base, até o dobro dele (telas de alta densidade). */
  static posterSrcSet(path: string | null | undefined, base: PosterSize): string | undefined {
    if (!path) return undefined
    const baseWidth = TmdbImage.posterWidths[base]
    return (Object.entries(TmdbImage.posterWidths) as [PosterSize, number][])
      .filter(([, w]) => w >= baseWidth && w <= baseWidth * 2.2)
      .map(([size, w]) => `${TmdbImage.BASE}/${size}${path} ${w}w`)
      .join(', ')
  }
}
