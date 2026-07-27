import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HomeShelf, formatEpisodeCode, formatWhen, posterUrl } from '@reprise/shared';
import type { NextUpItem } from '@reprise/shared';
import { useMarkEpisode, useNextUp, usePremieres, useProfile } from '../api/queries';
import { PremiereStrip } from '../components/PremiereStrip';
import { QueryState } from '../components/QueryState';
import './NextUpPage.css';

/**
 * Tela inicial: o que assistir agora.
 *
 * <b>A ordem da página é a resposta.</b> Antes ela abria com a faixa de estreias — inclusive as de
 * novembro do ano seguinte — e só depois trazia 49 linhas iguais, ordenadas por uma "última
 * atividade" que em 47 delas era a mesma data de importação. Ou seja: começava pelo que não dá
 * para assistir e terminava sem dizer o que retomar.
 *
 * Agora vai do mais acionável ao menos: o que você está assistindo, o que estreia em breve, e por
 * último o acervo guardado. O agrupamento vem do {@link HomeShelf} para que o app mostre as mesmas
 * prateleiras com os mesmos nomes.
 */
export function NextUpPage() {
  const query = useNextUp();
  const premieres = usePremieres();
  // Falha em silêncio: sem o nome, o cumprimento fica sem vocativo e a tela segue inteira.
  const profile = useProfile();

  return (
    <QueryState query={query}>
      {(items) => {
        const { emAndamento, guardadas } = HomeShelf.split(items);
        const proximas = HomeShelf.upcomingPremieres(premieres.data ?? []);
        const nome = profile.data?.displayName?.trim().split(/\s+/)[0];

        return (
          <>
            <header className="home-head">
              <h1 className="home-head__greeting">
                {HomeShelf.greeting()}
                {nome ? `, ${nome}` : ''}.
              </h1>
              <p className="home-head__summary">
                {HomeShelf.summary(emAndamento.length, guardadas.length)}
              </p>
            </header>

            {emAndamento.length > 0 ? (
              <section aria-labelledby="andamento-h">
                <h2 className="shelf-head" id="andamento-h">
                  Continuar assistindo
                </h2>
                <ul className="nextup" role="list">
                  {emAndamento.map((item) => (
                    <NextUpRow key={item.seriesId} item={item} />
                  ))}
                </ul>
              </section>
            ) : null}

            <PremiereStrip premieres={proximas} />

            {guardadas.length > 0 ? <Guardadas items={guardadas} /> : null}
          </>
        );
      }}
    </QueryState>
  );
}

/**
 * O acervo guardado, fechado por padrão.
 *
 * São 47 séries paradas na data da importação: abertas, empurram tudo que importa para fora da
 * tela; escondidas sem dizer, somem. Um `<details>` resolve os dois — anuncia quantas são, cabe em
 * uma linha, e abre com um clique (ou com Enter, porque é um elemento de verdade e não um `div`
 * que escuta clique).
 */
function Guardadas({ items }: { items: readonly NextUpItem[] }) {
  const [aberto, setAberto] = useState(false);

  return (
    <details className="shelf" open={aberto} onToggle={(e) => setAberto(e.currentTarget.open)}>
      <summary className="shelf__summary">
        <span className="shelf-head">Guardadas</span>
        <span className="shelf__count">{items.length} séries</span>
      </summary>

      <p className="shelf__note">
        Sem nenhuma exibição nos últimos dois meses. Ficam aqui sem pressa — retome quando quiser.
      </p>

      <ul className="nextup" role="list">
        {items.map((item) => (
          <NextUpRow key={item.seriesId} item={item} quieta />
        ))}
      </ul>
    </details>
  );
}

/**
 * Uma linha da fila. O pôster veio junto: o app já mostrava e o web não, e reconhecer a série pela
 * capa é mais rápido do que ler o nome — ainda mais numa lista longa.
 */
function NextUpRow({ item, quieta = false }: { item: NextUpItem; quieta?: boolean }) {
  const mark = useMarkEpisode();
  const poster = posterUrl(item.posterPath, 'w154');
  const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);

  return (
    <li className="nextup__item">
      <Link to={`/series/${item.seriesId}`} className="nextup__link">
        {poster ? (
          <img className="nextup__poster" src={poster} alt="" loading="lazy" />
        ) : (
          <span className="nextup__poster nextup__poster--vazio" aria-hidden="true" />
        )}

        <span className="nextup__body">
          <span className="nextup__series">{item.seriesName}</span>
          <span className="nextup__episode">
            <span className="tabular nextup__code">{code}</span>
            {item.episode.name ? <span>{item.episode.name}</span> : null}
          </span>
          {/* Nas guardadas a data é a mesma para quase todas; repeti-la 47 vezes é ruído, e a
              própria seção já explica de quando são. */}
          {quieta ? null : (
            <span className="nextup__when">Última atividade {formatWhen(item.lastActivityAt)}</span>
          )}
        </span>
      </Link>

      {/* O botão diz o que acontece ao ser apertado, não o que a pessoa fez. */}
      <button
        type="button"
        className={quieta ? 'btn btn--quiet' : 'btn btn--primary'}
        onClick={() => mark.mutate(item.episode.id)}
        disabled={mark.isPending}
      >
        Marcar como visto
        <span className="sr-only">
          {' '}
          {code} de {item.seriesName}
        </span>
      </button>
    </li>
  );
}
