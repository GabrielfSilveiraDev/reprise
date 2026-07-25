import { Link } from 'react-router-dom';
import { formatEpisodeCode, formatWatchedAt } from '@reprise/shared';
import { useMarkEpisode, useNextUp, usePremieres } from '../api/queries';
import { PremiereStrip } from '../components/PremiereStrip';
import { QueryState } from '../components/QueryState';
import './NextUpPage.css';

/**
 * Tela inicial: o próximo episódio não visto de cada série acompanhada, por atividade recente.
 * É a pergunta que o app existe para responder — por isso ela é a home, e não a lista.
 */
export function NextUpPage() {
  const query = useNextUp();
  const mark = useMarkEpisode();
  const premieres = usePremieres();

  return (
    <QueryState
      query={query}
      emptyWhen={(d) => d.length === 0}
      emptyTitle="Nada pendente"
      emptyHint="Todas as séries que você acompanha estão em dia."
    >
      {(items) => (
        <>
          {/* Falha em silêncio: não ter estreias não é motivo para a tela principal dar erro. */}
          <PremiereStrip premieres={premieres.data ?? []} />

          <header className="page-head">
            {/* "Próximos" nos dois clientes: a aba do app, o item de menu daqui e o rótulo da
                página passam a ser a mesma palavra. O h1 conta o resto. */}
            <p className="eyebrow">Próximos</p>
            <h1>
              {items.length} {items.length === 1 ? 'série' : 'séries'} esperando
            </h1>
          </header>

          <ul className="nextup" role="list">
            {items.map((item) => (
              <li key={item.seriesId} className="nextup__item">
                <div className="nextup__body">
                  <Link to={`/series/${item.seriesId}`} className="nextup__series">
                    {item.seriesName}
                  </Link>
                  <p className="nextup__episode">
                    <span className="tabular nextup__code">
                      {formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber)}
                    </span>
                    {item.episode.name ? <span>{item.episode.name}</span> : null}
                  </p>
                  <p className="nextup__when">
                    Última atividade {formatWatchedAt(item.lastActivityAt)}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => mark.mutate(item.episode.id)}
                  disabled={mark.isPending}
                >
                  Assisti
                  <span className="sr-only">
                    {' '}
                    {formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber)} de{' '}
                    {item.seriesName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </QueryState>
  );
}
