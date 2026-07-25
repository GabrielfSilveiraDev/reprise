import { useCallback, useRef } from 'react';
import {
  formatEpisodeCode,
  formatRuntime,
  formatWatchCount,
  formatWatchedAt,
  stillUrl,
} from '@reprise/shared';
import type { Episode } from '@reprise/shared';
import './EpisodeList.css';

interface Props {
  episodes: readonly Episode[];
  onMark: (episode: Episode) => void;
  onUnmark: (episode: Episode) => void;
  onMarkUpTo: (episode: Episode) => void;
  busyEpisodeId?: number | null;
}

/**
 * Lista de episódios com marcação.
 *
 * Navegação por teclado com foco itinerante (roving tabindex): a lista inteira é UMA parada
 * de tab, e as setas andam entre as linhas. Sem isso, uma temporada de 24 episódios viraria
 * 24 paradas de tab só para atravessar.
 *
 * Atalhos com a linha focada:  M marca (de novo = rewatch) · U desmarca · A marca até aqui.
 */
export function EpisodeList({ episodes, onMark, onUnmark, onMarkUpTo, busyEpisodeId }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  const moveFocus = useCallback((from: number, delta: number) => {
    const rows = listRef.current?.querySelectorAll<HTMLLIElement>('[data-row]');
    if (!rows?.length) return;
    const next = Math.min(Math.max(from + delta, 0), rows.length - 1);
    rows[next]?.focus();
  }, []);

  const handleKey = (event: React.KeyboardEvent<HTMLLIElement>, episode: Episode, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(index, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        moveFocus(index, -index);
        break;
      case 'End':
        event.preventDefault();
        moveFocus(index, episodes.length);
        break;
      case 'm':
      case 'M':
        event.preventDefault();
        onMark(episode);
        break;
      case 'u':
      case 'U':
        event.preventDefault();
        if (episode.watchCount > 0) onUnmark(episode);
        break;
      case 'a':
      case 'A':
        event.preventDefault();
        onMarkUpTo(episode);
        break;
      default:
        break;
    }
  };

  return (
    <ul className="episodes" ref={listRef} role="list">
      {episodes.map((episode, index) => {
        const watched = episode.watchCount > 0;
        const busy = busyEpisodeId === episode.id;

        return (
          <li
            key={episode.id}
            data-row
            className="episode"
            data-watched={watched}
            tabIndex={index === 0 ? 0 : -1}
            onKeyDown={(e) => handleKey(e, episode, index)}
          >
            {/*
              A capa entrou no web depois do app: 8.619 imagens estavam no banco sem ninguém
              exibi-las aqui. `loading="lazy"` porque uma temporada de 24 linhas não precisa
              buscar 24 imagens antes de a lista aparecer.
            */}
            {stillUrl(episode.stillPath, 'w185') ? (
              <img
                className="episode__still"
                src={stillUrl(episode.stillPath, 'w185') ?? undefined}
                alt=""
                loading="lazy"
                width={80}
                height={45}
              />
            ) : (
              /* Sem imagem, uma cartela tipográfica — não um retângulo vazio que pareça
                 carregamento falho. Mesmo raciocínio da versão do app. */
              <span className="episode__plate" aria-hidden="true">
                {episode.seasonNumber === 0 ? 'ESP' : `T${episode.seasonNumber}`}
                <b>{episode.episodeNumber}</b>
              </span>
            )}

            <span className="episode__code tabular">
              {formatEpisodeCode(episode.seasonNumber, episode.episodeNumber)}
            </span>

            <span className="episode__title">
              {episode.name ?? <span className="episode__untitled">Sem título</span>}
            </span>

            <span className="episode__meta tabular">{formatRuntime(episode.runtimeSeconds)}</span>

            {/*
              Estado por TEXTO, não por cor: "1×", "16×" ou "—". O leitor de tela recebe a
              forma por extenso, e quem enxerga lê o mesmo dado sem depender do tom do bloco.
            */}
            <span className="episode__count tabular" data-watched={watched}>
              <span aria-hidden="true">{watched ? `${episode.watchCount}×` : '—'}</span>
              <span className="sr-only">{formatWatchCount(episode.watchCount)}</span>
            </span>

            <span className="episode__when">{formatWatchedAt(episode.lastWatchedAt)}</span>

            <span className="episode__actions">
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => onMark(episode)}
                disabled={busy}
              >
                {/* "Assisti" / "Revi": primeira pessoa, passado, iguais no app. "Marcar" descrevia
                    a mecânica da interface em vez do que a pessoa fez. */}
                {watched ? 'Revi' : 'Assisti'}
                <span className="sr-only">
                  {' '}
                  {formatEpisodeCode(episode.seasonNumber, episode.episodeNumber)}
                </span>
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--danger"
                onClick={() => onUnmark(episode)}
                disabled={busy || !watched}
              >
                Desmarcar
                <span className="sr-only">
                  {' '}
                  {formatEpisodeCode(episode.seasonNumber, episode.episodeNumber)}
                </span>
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
