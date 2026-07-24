import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  formatEpisodeCode,
  formatPercent,
  formatSeriesStatus,
  posterUrl,
  WatchTrack,
} from '@reprise/shared';
import type { Episode, Season } from '@reprise/shared';
import {
  useMarkEpisode,
  useMarkSeason,
  useMarkUpTo,
  useSeriesDetail,
  useUnmarkEpisode,
} from '../api/queries';
import { EpisodeList } from '../components/EpisodeList';
import { EpisodeTrack } from '../components/EpisodeTrack';
import { QueryState } from '../components/QueryState';
import './SeriesDetailPage.css';

export function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const seriesId = Number(id);
  const query = useSeriesDetail(seriesId);

  const mark = useMarkEpisode(seriesId);
  const unmark = useUnmarkEpisode(seriesId);
  const markSeason = useMarkSeason(seriesId);
  const markUpTo = useMarkUpTo(seriesId);

  const busyEpisodeId = mark.isPending
    ? mark.variables
    : unmark.isPending
      ? unmark.variables
      : null;

  return (
    <QueryState query={query}>
      {(series) => {
        // Uma régua só para a série inteira: as temporadas ficam comparáveis entre si.
        const seriesPeak = WatchTrack.peakOf(
          series.seasons.flatMap((s) =>
            s.episodes.map((e) => ({
              id: e.id,
              seasonNumber: e.seasonNumber,
              episodeNumber: e.episodeNumber,
              watchCount: e.watchCount,
            })),
          ),
        );

        const poster = posterUrl(series.posterPath, 'w342');

        return (
          <article>
            <header className="detail-head">
              {poster ? (
                <img
                  className="detail-head__poster"
                  src={poster}
                  alt=""
                  width={140}
                  height={210}
                  loading="lazy"
                />
              ) : null}

              <div className="detail-head__body">
                <p className="eyebrow">
                  <Link to="/series" className="detail-head__back">
                    Séries
                  </Link>{' '}
                  · {formatSeriesStatus(series.status)}
                </p>
                <h1>{series.name}</h1>
                {series.originalName && series.originalName !== series.name ? (
                  <p className="detail-head__original">{series.originalName}</p>
                ) : null}

                <div className="progress detail-head__progress">
                  <span className="progress__text tabular">
                    {series.episodesWatched}/{series.episodesTotal} episódios
                  </span>
                  <div
                    className="progress__bar"
                    role="progressbar"
                    aria-valuenow={Math.round(series.completionRatio * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progresso de ${series.name}`}
                  >
                    <div
                      className="progress__fill"
                      style={{ width: formatPercent(series.completionRatio) }}
                    />
                  </div>
                  <span className="progress__text tabular">
                    {formatPercent(series.completionRatio)}
                  </span>
                </div>

                {series.overview ? <p className="detail-head__overview">{series.overview}</p> : null}
              </div>
            </header>

            <p className="shortcuts">
              Na lista de episódios: <kbd>↑</kbd> <kbd>↓</kbd> navegam · <kbd>M</kbd> marca (de novo
              = rewatch) · <kbd>U</kbd> desmarca · <kbd>A</kbd> marca até ali.
            </p>

            {series.seasons.map((season) => (
              <SeasonSection
                key={season.seasonNumber}
                season={season}
                seriesPeak={seriesPeak}
                busyEpisodeId={busyEpisodeId ?? null}
                onMark={(e) => mark.mutate(e.id)}
                onUnmark={(e) => unmark.mutate(e.id)}
                onMarkUpTo={(e) =>
                  markUpTo.mutate({
                    seasonNumber: e.seasonNumber,
                    episodeNumber: e.episodeNumber,
                  })
                }
                onMarkSeason={() => markSeason.mutate(season.seasonNumber)}
                markingSeason={markSeason.isPending}
              />
            ))}
          </article>
        );
      }}
    </QueryState>
  );
}

interface SeasonProps {
  season: Season;
  seriesPeak: number;
  busyEpisodeId: number | null;
  onMark: (e: Episode) => void;
  onUnmark: (e: Episode) => void;
  onMarkUpTo: (e: Episode) => void;
  onMarkSeason: () => void;
  markingSeason: boolean;
}

function SeasonSection({
  season,
  seriesPeak,
  busyEpisodeId,
  onMark,
  onUnmark,
  onMarkUpTo,
  onMarkSeason,
  markingSeason,
}: SeasonProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const watched = season.episodes.filter((e) => e.watchCount > 0).length;
  const title = season.isSpecials ? 'Especiais' : `Temporada ${season.seasonNumber}`;
  const headingId = `season-${season.seasonNumber}`;

  return (
    <section className="season" aria-labelledby={headingId}>
      <header className="season__head">
        <h2 id={headingId} className="season__title">
          {title}
        </h2>
        <span className="season__count tabular">
          {watched}/{season.episodes.length}
        </span>
        <button
          type="button"
          className="btn"
          onClick={onMarkSeason}
          disabled={markingSeason || watched === season.episodes.length}
        >
          Marcar temporada
          <span className="sr-only"> {title} inteira</span>
        </button>
      </header>

      <EpisodeTrack
        episodes={season.episodes}
        seriesPeak={seriesPeak}
        selectedId={selectedId}
        onSelect={(e) => setSelectedId((current) => (current === e.id ? null : e.id))}
      />

      <p className="track-legend">
        <span>Altura do bloco = quantas vezes você assistiu.</span>
        <span className="track-legend__swatches" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className="track-legend__swatch" data-level={level} />
          ))}
        </span>
        <span>menos → mais</span>
      </p>

      {selectedId ? (
        <p className="season__selected" role="status" aria-live="polite">
          {(() => {
            const e = season.episodes.find((x) => x.id === selectedId);
            if (!e) return null;
            return `${formatEpisodeCode(e.seasonNumber, e.episodeNumber)}${
              e.name ? ` — ${e.name}` : ''
            }: ${e.watchCount === 0 ? 'não assistido' : `${e.watchCount}×`}`;
          })()}
        </p>
      ) : null}

      <EpisodeList
        episodes={season.episodes}
        onMark={onMark}
        onUnmark={onUnmark}
        onMarkUpTo={onMarkUpTo}
        busyEpisodeId={busyEpisodeId}
      />
    </section>
  );
}
