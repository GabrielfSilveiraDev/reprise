import { formatEpisodeCode, formatWatchCount } from './format';

/** O mínimo que a trilha precisa saber de um episódio. */
export interface TrackEpisode {
  readonly id: number;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly name?: string | null;
  readonly watchCount: number;
}

/** Um bloco da trilha: um episódio, com a intensidade já resolvida. */
export interface TrackBlock {
  readonly episode: TrackEpisode;
  /** 0 = não visto; 1..MAX_LEVEL = visto, crescendo com o número de exibições. */
  readonly level: number;
  /** Fração de preenchimento (0..1) — a altura do bloco. */
  readonly fill: number;
  /** Rótulo textual: o estado NUNCA é comunicado só por cor/altura. */
  readonly label: string;
}

/**
 * Trilha de blocos de uma temporada: um bloco por episódio, com a altura indicando
 * quantas vezes ele foi assistido.
 *
 * A escala é relativa à própria série, não absoluta. Numa série vista uma vez só, quem
 * tem 1 exibição já aparece cheio; numa série com um episódio visto 16 vezes, 1 exibição
 * é um bloco baixo. Escala absoluta achataria a maioria das séries num traço uniforme e
 * a leitura de "onde eu mais voltei" — que é o ponto do app — se perderia.
 *
 * A altura é reforço visual, nunca o único canal: cada bloco carrega `label` para leitor
 * de tela e tooltip, e a UI marca "não visto" também por contorno tracejado.
 */
export class WatchTrack {
  static readonly MAX_LEVEL = 4;

  readonly blocks: readonly TrackBlock[];
  readonly peakWatchCount: number;

  // Campos explícitos em vez de propriedades de parâmetro: estas dependem de emissão de
  // código e quebram sob `erasableSyntaxOnly`, que o Vite e o type-stripping do Node usam.
  private constructor(blocks: readonly TrackBlock[], peakWatchCount: number) {
    this.blocks = blocks;
    this.peakWatchCount = peakWatchCount;
  }

  /**
   * @param episodes episódios da temporada, na ordem de exibição
   * @param seriesPeak maior número de exibições em QUALQUER episódio da série; passe-o para
   *   que todas as temporadas compartilhem a mesma régua. Omitido, a régua é a da temporada.
   */
  static from(episodes: readonly TrackEpisode[], seriesPeak?: number): WatchTrack {
    const peak = Math.max(1, seriesPeak ?? WatchTrack.peakOf(episodes));

    const blocks = episodes.map<TrackBlock>((episode) => {
      const level = WatchTrack.levelFor(episode.watchCount, peak);
      return {
        episode,
        level,
        fill: level === 0 ? 0 : level / WatchTrack.MAX_LEVEL,
        label: WatchTrack.labelFor(episode),
      };
    });

    return new WatchTrack(blocks, peak);
  }

  static peakOf(episodes: readonly TrackEpisode[]): number {
    return episodes.reduce((max, e) => Math.max(max, e.watchCount), 0);
  }

  private static levelFor(watchCount: number, peak: number): number {
    if (watchCount <= 0) return 0;
    // Uma exibição sempre acende pelo menos o nível 1 — "visto" nunca some na escala.
    const ratio = watchCount / peak;
    return Math.max(1, Math.ceil(ratio * WatchTrack.MAX_LEVEL));
  }

  private static labelFor(e: TrackEpisode): string {
    const code = formatEpisodeCode(e.seasonNumber, e.episodeNumber);
    const title = e.name ? ` — ${e.name}` : '';
    return `${code}${title}: ${formatWatchCount(e.watchCount)}`;
  }

  get watchedCount(): number {
    return this.blocks.filter((b) => b.episode.watchCount > 0).length;
  }

  get total(): number {
    return this.blocks.length;
  }
}
