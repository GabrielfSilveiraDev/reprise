import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatEpisodeCode,
  formatPercent,
  formatSeriesStatus,
  formatWatchedAt,
  posterUrl,
} from '@reprise/shared';
import type { SeriesListItem } from '@reprise/shared';
import { useSeriesList } from '../api/queries';
import { QueryState } from '../components/QueryState';
import './SeriesListPage.css';

type Density = 'compact' | 'expanded';

/**
 * Lista de séries em duas densidades, como pede o briefing:
 *  - compacta: uma linha por série, para varrer o acervo inteiro rápido;
 *  - expandida: um cartão com pôster e sinopse curta, para navegar sem pressa.
 *
 * Nenhuma das duas é uma grade de pôsteres com selo colorido: o eixo de leitura é o
 * nome da série e o número, não a capa.
 */
export function SeriesListPage() {
  const query = useSeriesList();
  const [density, setDensity] = useState<Density>('compact');
  const [filter, setFilter] = useState('');

  return (
    <>
      <header className="page-head list-head">
        <div>
          <p className="eyebrow">Acervo</p>
          <h1>Séries</h1>
        </div>

        <div className="list-head__controls">
          <label className="field">
            <span className="sr-only">Filtrar por nome</span>
            <input
              type="search"
              className="field__input"
              placeholder="Filtrar…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>

          <fieldset className="density">
            <legend className="sr-only">Densidade da lista</legend>
            {(['compact', 'expanded'] as const).map((value) => (
              <label key={value} className="density__option">
                <input
                  type="radio"
                  name="density"
                  value={value}
                  checked={density === value}
                  onChange={() => setDensity(value)}
                />
                <span>{value === 'compact' ? 'Compacta' : 'Expandida'}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </header>

      <QueryState
        query={query}
        emptyWhen={(d) => d.length === 0}
        emptyTitle="Nenhuma série"
        emptyHint="Importe seu export do TV Time para começar."
      >
        {(all) => {
          const items = all.filter((s) =>
            s.name.toLowerCase().includes(filter.trim().toLowerCase()),
          );

          if (items.length === 0) {
            return (
              <p className="state" role="status">
                Nada encontrado para “{filter}”.
              </p>
            );
          }

          return (
            <>
              <p className="list-count" role="status" aria-live="polite">
                {items.length} de {all.length}
              </p>
              <ul className={`series series--${density}`} role="list">
                {items.map((series) =>
                  density === 'compact' ? (
                    <CompactRow key={series.id} series={series} />
                  ) : (
                    <ExpandedCard key={series.id} series={series} />
                  ),
                )}
              </ul>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

function Progress({ series }: { series: SeriesListItem }) {
  return (
    <div className="progress">
      <span className="progress__text tabular">
        {series.episodesWatched}/{series.episodesTotal}
      </span>
      <div
        className="progress__bar"
        role="progressbar"
        aria-valuenow={Math.round(series.completionRatio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso de ${series.name}`}
      >
        <div className="progress__fill" style={{ width: formatPercent(series.completionRatio) }} />
      </div>
      <span className="progress__text tabular">{formatPercent(series.completionRatio)}</span>
    </div>
  );
}

function CompactRow({ series }: { series: SeriesListItem }) {
  return (
    <li className="series__row">
      <Link to={`/series/${series.id}`} className="series__name">
        {series.name}
      </Link>
      <span className="series__status">{formatSeriesStatus(series.status)}</span>
      <Progress series={series} />
      <span className="series__next tabular">
        {series.nextUp
          ? formatEpisodeCode(series.nextUp.seasonNumber, series.nextUp.episodeNumber)
          : '—'}
      </span>
      <span className="series__when">{formatWatchedAt(series.lastWatchedAt)}</span>
    </li>
  );
}

function ExpandedCard({ series }: { series: SeriesListItem }) {
  const poster = posterUrl(series.posterPath, 'w154');

  return (
    <li className="series__card">
      {poster ? (
        // alt vazio: o nome da série está logo ao lado como texto — anunciar de novo seria ruído.
        <img className="series__poster" src={poster} alt="" width={77} height={115} loading="lazy" />
      ) : (
        <div className="series__poster series__poster--empty" aria-hidden="true" />
      )}

      <div className="series__card-body">
        <Link to={`/series/${series.id}`} className="series__name series__name--lg">
          {series.name}
        </Link>
        <p className="series__status">{formatSeriesStatus(series.status)}</p>
        <Progress series={series} />
        <p className="series__when">
          {series.nextUp ? (
            <>
              Próximo{' '}
              <strong className="tabular">
                {formatEpisodeCode(series.nextUp.seasonNumber, series.nextUp.episodeNumber)}
              </strong>
              {series.nextUp.name ? ` — ${series.nextUp.name}` : ''}
            </>
          ) : (
            'Em dia'
          )}{' '}
          · visto {formatWatchedAt(series.lastWatchedAt)}
        </p>
      </div>
    </li>
  );
}
