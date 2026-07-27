import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Airing,
  formatEpisodeCode,
  formatPercent,
  formatSeriesStatus,
  posterUrl,
  SeriesCompletion,
  WatchTrack,
} from '@reprise/shared';
import type { Episode, Season } from '@reprise/shared';
import { SERIES_STATUSES } from '@reprise/shared';
import {
  useMarkEpisode,
  useMarkSeason,
  useMarkUpTo,
  useSetSeriesStatus,
  useSeriesDetail,
  useUnmarkEpisode,
} from '../api/queries';
import { EpisodeList } from '../components/EpisodeList';
import { EpisodeTrack } from '../components/EpisodeTrack';
import { QueryState } from '../components/QueryState';
import { RewatchSessions } from '../components/RewatchSessions';
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
        const completion = SeriesCompletion.of({
          productionStatus: series.productionStatus,
          episodesTotal: series.episodesTotal,
          episodesAired: series.episodesAired,
          episodesWatched: series.episodesWatched,
        });

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

                <StatusPicker seriesId={seriesId} current={series.status} />

                {/* Mesma cor por estado da lista: a série tem de se parecer consigo mesma nas
                    duas telas. `data-state` define `--progress-color`, que a barra consome. */}
                <div className="progress detail-head__progress" data-state={completion.state}>
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

                {/* A frase completa do estado, que a barra sozinha não dá: "faltam 4", "em dia —
                    mais 6 a caminho". É aqui que o episódio agendado deixa de parecer pendência. */}
                <p className="detail-head__state">{completion.label}</p>

                {series.overview ? <p className="detail-head__overview">{series.overview}</p> : null}
              </div>
            </header>

            {/* Antes das temporadas: "quantas vezes eu percorri isto" vem antes de "onde eu
                estou nesta passada". */}
            <RewatchSessions
              sessions={series.sessions}
              backfillExhibitions={series.backfillExhibitions}
            />

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

/**
 * Estado de acompanhamento. `fieldset` + `radio` porque é escolha exclusiva de verdade: o
 * navegador já dá navegação por setas e o leitor de tela anuncia "1 de 4" sem ajuda nenhuma.
 * Existia só no app — pelo web não havia como arquivar uma série.
 */
function StatusPicker({ seriesId, current }: { seriesId: number; current: string }) {
  const setStatus = useSetSeriesStatus(seriesId);

  return (
    <fieldset className="status-picker">
      <legend className="sr-only">Estado desta série</legend>
      {SERIES_STATUSES.map((status) => (
        <label key={status} className="status-picker__option">
          <input
            type="radio"
            name="series-status"
            value={status}
            checked={status === current}
            disabled={setStatus.isPending}
            onChange={() => setStatus.mutate(status)}
          />
          <span>{formatSeriesStatus(status)}</span>
        </label>
      ))}
    </fieldset>
  );
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
  // O que dá para marcar: não visto E já exibido. Sem o segundo filtro, "Marcar 6" na Silo
  // prometia marcar seis episódios e o servidor marcaria dois — o botão mentiria o número.
  const unseen = season.episodes.filter(
    (e) => e.watchCount === 0 && Airing.hasAired(e.airDate),
  ).length;
  const porVir = season.episodes.filter((e) => !Airing.hasAired(e.airDate)).length;
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
        {/*
          "Marcar N" nos dois clientes, com N = quantos faltam: o rótulo genérico não dizia
          quantos episódios o clique ia criar. E o botão SOME quando não há o que marcar, como
          no app — desabilitado com "Marcar 0" é um controle que ocupa espaço para não fazer nada.
        */}
        {unseen > 0 ? (
          <button type="button" className="btn" onClick={onMarkSeason} disabled={markingSeason}>
            Marcar {unseen}
            <span className="sr-only"> episódios não vistos de {title}</span>
          </button>
        ) : porVir > 0 ? (
          <span className="season__done">
            em dia · {porVir === 1 ? 'mais 1 a caminho' : `mais ${porVir} a caminho`}
          </span>
        ) : (
          <span className="season__done">completa</span>
        )}
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
