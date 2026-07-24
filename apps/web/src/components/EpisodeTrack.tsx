import { WatchTrack } from '@reprise/shared';
import type { Episode } from '@reprise/shared';
import './EpisodeTrack.css';

interface Props {
  episodes: readonly Episode[];
  seriesPeak: number;
  onSelect: (episode: Episode) => void;
  selectedId?: number | null;
}

/**
 * Trilha de blocos: um bloco por episódio, altura proporcional ao número de exibições.
 *
 * Acessibilidade: é uma lista semântica de botões, não um gráfico decorativo. Cada bloco
 * carrega o rótulo textual completo ("T7E2 — Título: assistido 16 vezes"), então o estado
 * nunca depende só da altura ou da cor. Não visto ganha contorno tracejado além do tom
 * apagado — segundo canal visual, como manda o requisito de não codificar por cor apenas.
 */
export function EpisodeTrack({ episodes, seriesPeak, onSelect, selectedId }: Props) {
  const track = WatchTrack.from(
    episodes.map((e) => ({
      id: e.id,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      name: e.name,
      watchCount: e.watchCount,
    })),
    seriesPeak,
  );

  return (
    <ul className="track" role="list">
      {track.blocks.map((block, index) => {
        const episode = episodes[index]!;
        const watched = block.episode.watchCount > 0;
        return (
          <li key={block.episode.id} className="track__slot">
            <button
              type="button"
              className="track__block"
              data-level={block.level}
              data-watched={watched}
              data-selected={selectedId === block.episode.id}
              style={{ '--fill': `${Math.max(block.fill, 0.12) * 100}%` } as React.CSSProperties}
              onClick={() => onSelect(episode)}
              aria-pressed={selectedId === block.episode.id}
            >
              <span className="sr-only">{block.label}</span>
              <span className="track__fill" aria-hidden="true" />
              <span className="track__number tabular" aria-hidden="true">
                {block.episode.episodeNumber}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
