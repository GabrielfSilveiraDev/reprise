import { Link } from 'react-router-dom';
import { Airing, formatEpisodeCode, stillUrl } from '@reprise/shared';
import type { Premiere } from '@reprise/shared';
import './PremiereStrip.css';

/**
 * O que ainda vai estrear, no topo de "Próximos".
 *
 * Mesmo lugar e mesma lógica do app: aquela tela responde "o que assisto agora", e estreias
 * respondem a mesma pergunta no futuro. O que muda é a forma — aqui há largura para uma grade,
 * enquanto no celular é uma faixa que rola de lado.
 *
 * Nada aqui se marca como assistido: o episódio ainda não foi ao ar.
 */
export function PremiereStrip({ premieres }: { premieres: readonly Premiere[] }) {
  if (premieres.length === 0) return null;

  return (
    <section className="premieres" aria-labelledby="premieres-heading">
      <div className="premieres__head">
        <h2 id="premieres-heading" className="eyebrow">
          Estreias
        </h2>
        <span className="premieres__count">
          {premieres.length} {premieres.length === 1 ? 'episódio' : 'episódios'}
        </span>
      </div>

      <ul className="premieres__list" role="list">
        {premieres.map((p) => {
          const still = stillUrl(p.stillPath, 'w300');
          // A âncora de meio-dia UTC estava escrita aqui e em mais três lugares; agora mora com
          // a regra de estreia, que é de quem ela é.
          const quando = Airing.label(p.airDate);

          return (
            <li key={p.episodeId} className="premiere">
              <Link to={`/series/${p.seriesId}`} className="premiere__link">
                {still ? (
                  <img className="premiere__still" src={still} alt="" loading="lazy" />
                ) : (
                  <span className="premiere__plate" aria-hidden="true">
                    {p.seasonNumber === 0 ? 'ESP' : `T${p.seasonNumber}`}
                    <b>{p.episodeNumber}</b>
                  </span>
                )}

                <span className="premiere__when">{quando}</span>
                <span className="premiere__series">{p.seriesName}</span>
                <span className="premiere__episode">
                  {formatEpisodeCode(p.seasonNumber, p.episodeNumber)}
                  {/* Estreia de temporada é a notícia; o sétimo episódio não é. */}
                  {p.isSeasonPremiere ? ' · nova temporada' : ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
