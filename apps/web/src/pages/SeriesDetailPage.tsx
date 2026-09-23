import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Airing,
  formatEpisodeCode,
  formatPercent,
  formatSeriesStatus,
  posterUrl,
  SeasonDisclosure,
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
import { SeasonPreferences } from '../preferences';
import './SeriesDetailPage.css';

export function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const seriesId = Number(id);
  const query = useSeriesDetail(seriesId);

  const mark = useMarkEpisode(seriesId);
  const unmark = useUnmarkEpisode(seriesId);
  const markSeason = useMarkSeason(seriesId);
  const markUpTo = useMarkUpTo(seriesId);

  /*
   * O estado das temporadas mora AQUI, e não em cada seção.
   *
   * A preferência é guardada por série, numa chave só. Com cada seção lendo e escrevendo por
   * conta própria, dois cliques seguidos em temporadas diferentes sobrescreveriam um ao outro —
   * cada uma gravaria o mapa que leu antes do clique da outra. Um dono só do mapa resolve isso
   * por construção.
   */
  const [disclosure, setDisclosure] = useState(() => SeasonPreferences.read(seriesId));

  const toggleSeason = (seasonNumber: number, open: boolean) => {
    const next = SeasonDisclosure.toggle(disclosure, seasonNumber, open);
    setDisclosure(next);
    SeasonPreferences.write(seriesId, next);
  };

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
              Na lista de episódios: <kbd>↑</kbd> <kbd>↓</kbd> navegam · <kbd>Enter</kbd> abre os
              detalhes · <kbd>M</kbd> marca (de novo = rewatch) · <kbd>U</kbd> desmarca ·{' '}
              <kbd>A</kbd> marca até ali.
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
                open={SeasonDisclosure.isOpen(season.seasonNumber, disclosure, series.seasons)}
                onToggle={(open) => toggleSeason(season.seasonNumber, open)}
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
  open: boolean;
  onToggle: (open: boolean) => void;
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
  open,
  onToggle,
}: SeasonProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const watched = season.episodes.filter((e) => e.watchCount > 0).length;
  // O que dá para marcar: não visto E já exibido. Sem o segundo filtro, "Marcar 6" na Silo
  // prometia marcar seis episódios e o servidor marcaria dois — o botão mentiria o número.
  const unseen = season.episodes.filter(
    (e) => e.watchCount === 0 && Airing.hasReleased(e.releasesAt, e.airDate),
  ).length;
  // "Por vir" conta o que ainda não SAIU — pelo instante, não pela data. O episódio cuja
  // air_date é hoje mas que só chega de madrugada continua sendo um episódio por vir.
  const porVir = season.episodes.filter(
    (e) => !Airing.hasReleased(e.releasesAt, e.airDate)
  ).length;
  const title = season.isSpecials ? 'Especiais' : `Temporada ${season.seasonNumber}`;
  const headingId = `season-${season.seasonNumber}`;

  const panelId = `season-${season.seasonNumber}-painel`;

  return (
    <section className="season" aria-labelledby={headingId}>
      <header className="season__head">
        {/*
          O título é o botão de abrir e fechar — o alvo que a pessoa já ia mirar para achar a
          temporada. A seta é TEXTO, e não a rotação de um ícone: o estado precisa sobreviver a
          quem não distingue as duas inclinações.
        */}
        <h2 id={headingId} className="season__title">
          <button
            type="button"
            className="season__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => onToggle(!open)}
          >
            <span className="season__chevron" aria-hidden="true">
              {open ? '▾' : '▸'}
            </span>
            {title}
            <span className="sr-only">{open ? ' — recolher' : ' — expandir'}</span>
          </button>
        </h2>
        {/* O progresso fica no cabeçalho para continuar legível com a temporada fechada. */}
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
          /*
            Os dois estados usam o selo de `ui.css`, o mesmo da lista de séries — antes eram texto
            apagado no canto, do tom de um rótulo secundário, e "completa" era justamente a
            informação que a pessoa procura ao varrer as temporadas de uma série longa.
            O texto continua dizendo tudo: a cor é reforço, não o dado.
          */
          <span className="badge badge--uptodate">
            Em dia · {porVir === 1 ? 'mais 1 a caminho' : `mais ${porVir} a caminho`}
          </span>
        ) : (
          <span className="badge badge--finished">Completa</span>
        )}
      </header>

      {/*
        Fechada, a temporada some inteira do DOM — trilha, legenda e lista. `hidden` deixaria
        centenas de linhas e imagens montadas em série longa, e o custo de remontar ao reabrir é
        menor do que o de manter tudo vivo o tempo todo.
      */}
      {open ? (
        <div id={panelId}>
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
        </div>
      ) : null}
    </section>
  );
}
