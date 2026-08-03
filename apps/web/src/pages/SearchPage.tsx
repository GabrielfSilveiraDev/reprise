import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatSeriesStatus, posterUrl } from '@reprise/shared';
import type { SeriesSearchResult } from '@reprise/shared';
import { useAddSeries, useSeriesSearch } from '../api/queries';
import { IconSearch, IconXCircle } from '../components/Icons';
import { QueryState } from '../components/QueryState';
import './SearchPage.css';

/**
 * O termo, alguns instantes depois de parar de digitar.
 *
 * Cada busca custa duas requisições ao TMDB no servidor. Sem o atraso, escrever "severance" custaria
 * nove buscas — dezoito requisições — para chegar ao mesmo resultado da última.
 */
function useDebounced(value: string, delayMs = 350): string {
  const [atrasado, setAtrasado] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setAtrasado(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return atrasado;
}

/** O ano de estreia, que é o que separa duas séries de mesmo nome. */
function anoDe(result: SeriesSearchResult): string | null {
  return result.firstAirDate ? result.firstAirDate.slice(0, 4) : null;
}

/**
 * A capa, com a inicial da série por baixo.
 *
 * A inicial não cobre só o caso "sem capa": ela é também o estado de carregamento. Um retângulo
 * cinza enquanto a imagem chega é indistinguível de uma imagem que falhou, e é o que fazia a lista
 * parecer quebrada nos primeiros instantes. Com a letra sempre desenhada e a imagem entrando por
 * cima, não existe quadro vazio.
 *
 * Sem `loading="lazy"`: a busca devolve no máximo 20 linhas e o que atrasa uma capa é a conexão,
 * não o peso. Adiar o pedido das que estão logo abaixo da dobra só faz pagar a espera de novo na
 * primeira rolagem.
 */
function Poster({ result }: { result: SeriesSearchResult }) {
  const src = posterUrl(result.posterPath, 'w154');

  return (
    <span className="hit__poster" aria-hidden="true">
      <span className="hit__poster-inicial">{result.name.trim().charAt(0).toUpperCase()}</span>
      {/* alt vazio: o nome da série está ao lado, como texto. Anunciá-lo de novo é ruído. */}
      {src ? <img className="hit__poster-img" src={src} alt="" decoding="async" /> : null}
    </span>
  );
}

/**
 * O que fazer com este resultado.
 *
 * São três situações, e colapsá-las em "Adicionar" mentiria em duas delas:
 *  - já acompanho: não há o que adicionar, e o útil é o caminho para a série;
 *  - existe no catálogo mas não acompanho: adicionar é barato (os episódios já estão lá);
 *  - não existe: adicionar traz o catálogo inteiro do TMDB.
 *
 * O catálogo é global — outra pessoa pode já ter trazido a série —, então "existe" e "eu acompanho"
 * são mesmo perguntas diferentes.
 */
function Acao({ result }: { result: SeriesSearchResult }) {
  const adicionar = useAddSeries();
  const pendente = adicionar.isPending && adicionar.variables === result.tmdbId;

  if (result.trackedStatus) {
    return (
      <div className="hit__acao">
        <span className="hit__selo">{formatSeriesStatus(result.trackedStatus)}</span>
        {result.seriesId ? (
          <Link className="btn btn--quiet" to={`/series/${result.seriesId}`}>
            Abrir
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="hit__acao">
      <button
        type="button"
        className="btn btn--primary"
        disabled={adicionar.isPending}
        onClick={() => adicionar.mutate(result.tmdbId)}
      >
        {pendente ? 'Adicionando…' : 'Adicionar'}
      </button>
      {/* O erro fica ao lado do botão que o causou, não num aviso global: com dez resultados na
          tela, um alerta no topo não diz qual das dez falhou. */}
      {adicionar.isError && adicionar.variables === result.tmdbId ? (
        <p className="hit__erro" role="alert">
          {adicionar.error instanceof Error ? adicionar.error.message : 'Não deu para adicionar.'}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Busca de séries novas — o caminho de entrada que não passa pelo importador do TV Time.
 *
 * A lista de resultados vem do TMDB já cruzada com o acervo: o servidor marca o que você tem, e é
 * por isso que dá para distinguir "adicionar" de "abrir" sem uma segunda consulta aqui.
 */
export function SearchPage() {
  const [termo, setTermo] = useState('');
  const termoBuscado = useDebounced(termo);
  const query = useSeriesSearch(termoBuscado);

  const curto = termoBuscado.trim().length < 2;

  return (
    <>
      <div className="page-head">
        <h1>Buscar séries</h1>
        <p className="search__intro">
          Procure no TMDB e adicione ao seu acervo. As capas vêm em inglês; os títulos de episódio,
          em português.
        </p>
      </div>

      <div className="field search__field">
        <label className="field__label" htmlFor="busca">
          Nome da série
        </label>

        {/*
          Lupa à esquerda, limpar à direita — o mesmo desenho do app.

          A borda vive nesta caixa e não no `<input>`, para que o foco destaque o campo inteiro com
          os ícones dentro. O `:focus-within` faz esse trabalho, então o teclado continua tendo o
          mesmo destaque que sempre teve.

          `type="search"` já traz um "x" nativo em alguns navegadores, mas ele não existe no Firefox
          e muda de forma entre os outros. Um botão nosso é o mesmo em todo lugar — e é por isso que
          o nativo sai por CSS.
        */}
        <div className="search__caixa">
          <IconSearch className="search__lupa" size={18} />

          <input
            id="busca"
            className="search__input"
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Severance, Dark, O Estranho…"
            autoComplete="off"
            autoFocus
          />

          {termo ? (
            <button
              type="button"
              className="search__limpar"
              onClick={() => setTermo('')}
              aria-label="Limpar busca"
            >
              <IconXCircle size={18} />
            </button>
          ) : null}
        </div>

        <p className="field__hint">Ao menos 2 caracteres.</p>
      </div>

      {curto ? (
        <div className="state">
          <p className="state__title">Digite para buscar</p>
          <p>O que você adicionar aqui entra na sua lista já com o catálogo de episódios.</p>
        </div>
      ) : (
        <QueryState
          query={query}
          emptyWhen={(r) => r.length === 0}
          emptyTitle="Nenhuma série encontrada"
          emptyHint="Tente o título original, ou em inglês."
        >
          {(resultados) => (
            <ul className="hits" role="list">
              {resultados.map((r) => (
                <li className="hit" key={r.tmdbId}>
                  <Poster result={r} />

                  <div className="hit__texto">
                    <p className="hit__nome">
                      {r.name}
                      {anoDe(r) ? <span className="hit__ano"> ({anoDe(r)})</span> : null}
                    </p>
                    {/* O título original só aparece quando difere do exibido — repetir a mesma
                        string duas vezes seria ruído em toda linha ocidental. */}
                    {r.originalName && r.originalName !== r.name ? (
                      <p className="hit__original">{r.originalName}</p>
                    ) : null}
                    {r.overview ? <p className="hit__sinopse">{r.overview}</p> : null}
                  </div>

                  <Acao result={r} />
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      )}
    </>
  );
}
