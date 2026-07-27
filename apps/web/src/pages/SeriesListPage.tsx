import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SeriesCompletion,
  formatEpisodeCode,
  formatPercent,
  formatSeriesStatus,
  formatWhen,
  posterUrl,
} from '@reprise/shared';
import type { SeriesListItem } from '@reprise/shared';
import { useSeriesList } from '../api/queries';
import { QueryState } from '../components/QueryState';
import './SeriesListPage.css';

type Density = 'compact' | 'expanded';
type Filter = 'all' | 'unfinished' | 'finished';

function completionOf(series: SeriesListItem): SeriesCompletion {
  return SeriesCompletion.of({
    productionStatus: series.productionStatus,
    episodesTotal: series.episodesTotal,
    episodesAired: series.episodesAired,
    episodesWatched: series.episodesWatched,
  });
}

/**
 * A capa, no tamanho que a linha comportar.
 *
 * <b>Sem imagem, uma cartela com a inicial — não um retângulo vazio.</b> Um bloco cinza no lugar
 * de uma imagem é indistinguível de uma imagem que falhou ao carregar, e é isso que faz a lista
 * parecer quebrada em vez de incompleta.
 */
function Poster({ series, size }: { series: SeriesListItem; size: 'w154' | 'w342' }) {
  const src = posterUrl(series.posterPath, size);

  // alt vazio: o nome da série está ao lado, como texto. Anunciá-lo de novo é ruído.
  return src ? (
    <img className="series__poster" src={src} alt="" loading="lazy" decoding="async" />
  ) : (
    <span className="series__poster series__poster--empty" aria-hidden="true">
      {series.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Selo de conclusão. Existia só no app até agora, e a ausência aqui era um buraco real: no web,
 * 52 séries encerradas e terminadas ficavam indistinguíveis das que ainda vão render temporada.
 * Texto, não cor — "Finalizada" tem de ser legível em preto e branco.
 */
function CompletionBadge({ completion }: { completion: SeriesCompletion }) {
  const badge = completion.badge;
  if (!badge) return null;
  return (
    <span className={`badge badge--${completion.isFinished ? 'finished' : 'uptodate'}`}>
      {badge}
    </span>
  );
}

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
  const [state, setState] = useState<Filter>('all');

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
            <legend className="sr-only">Filtrar por conclusão</legend>
            {(
              [
                ['all', 'Todas'],
                ['unfinished', 'Em aberto'],
                ['finished', 'Finalizadas'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="density__option">
                <input
                  type="radio"
                  name="conclusao"
                  value={value}
                  checked={state === value}
                  onChange={() => setState(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

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
          const items = all.filter((s) => {
            if (!s.name.toLowerCase().includes(filter.trim().toLowerCase())) return false;
            if (state === 'all') return true;
            return state === 'finished' ? completionOf(s).isFinished : !completionOf(s).isFinished;
          });

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

/**
 * Quando a série foi tocada pela última vez, em frase completa.
 *
 * `formatWatchedAt` devolve "nunca" para quem nunca assistiu, e a linha dizia "· visto nunca" —
 * uma frase que ninguém escreveria. Sem exibição, o que há a dizer é outra coisa.
 */
function ultimaVez(series: SeriesListItem): string {
  return series.lastWatchedAt ? `visto ${formatWhen(series.lastWatchedAt)}` : 'nunca assistida';
}

function CompactRow({ series }: { series: SeriesListItem }) {
  const completion = completionOf(series);

  return (
    // `data-state` só existe para o CSS escolher a cor da barra. O estado continua chegando ao
    // leitor de tela por texto, no selo e no rótulo — atributo de dado não é anunciado.
    <li className="series__row" data-state={completion.state}>
      {/* A capa é o que faz reconhecer a série antes de ler o nome. Faltava só nesta densidade —
          a lista inteira era texto sobre texto. */}
      <Poster series={series} size="w154" />
      <Link to={`/series/${series.id}`} className="series__name">
        {series.name}
      </Link>
      <span className="series__status">
        <CompletionBadge completion={completion} />
        {formatSeriesStatus(series.status)}
      </span>
      <Progress series={series} />
      <span className="series__next tabular">
        {series.nextUp
          ? formatEpisodeCode(series.nextUp.seasonNumber, series.nextUp.episodeNumber)
          : '—'}
      </span>
      <span className="series__when">{ultimaVez(series)}</span>
    </li>
  );
}

function ExpandedCard({ series }: { series: SeriesListItem }) {
  const completion = completionOf(series);

  return (
    <li className="series__card" data-state={completion.state}>
      <Poster series={series} size="w342" />

      <div className="series__card-body">
        <Link to={`/series/${series.id}`} className="series__name series__name--lg">
          {series.name}
        </Link>
        <p className="series__status">
          <CompletionBadge completion={completion} />
          {formatSeriesStatus(series.status)}
        </p>
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
            completion.label
          )}{' '}
          · {ultimaVez(series)}
        </p>
      </div>
    </li>
  );
}
