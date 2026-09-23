import { useCallback, useRef, useState } from 'react';
import {
  Airing,
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

  /*
   * UM painel aberto por vez.
   *
   * Guardar um conjunto deixaria a temporada inteira aberta a cliques distraídos, e aí a lista
   * compacta — que existe para varrer o acervo — vira uma pilha de sinopses. Abrir um episódio
   * fecha o anterior, como acontece ao trocar de aba.
   */
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const alternarDetalhe = useCallback(
    (id: number) => setDetalheId((atual) => (atual === id ? null : id)),
    [],
  );

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
        // O atalho obedece à mesma regra do botão: o teclado não é uma porta dos fundos.
        if (Airing.hasReleased(episode.releasesAt, episode.airDate)) onMark(episode);
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
      // O detalhe entra no mesmo esquema dos outros atalhos. Enter porque é o que se espera de
      // uma linha focada; D para quem já decorou as letras.
      case 'Enter':
      case 'd':
      case 'D':
        event.preventDefault();
        alternarDetalhe(episode.id);
        break;
      case 'Escape':
        if (detalheId !== null) {
          event.preventDefault();
          setDetalheId(null);
        }
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
        // Episódio não lançado não se marca — nem por botão, nem por atalho, nem no servidor.
        const aired = Airing.hasReleased(episode.releasesAt, episode.airDate);
        // O texto fala pelo instante de estreia (fuso de origem da série); o BOTÃO continua
        // pela data, permissivo. Ver Airing: são perguntas diferentes de propósito.
        const quando = Airing.label(episode.airDate, undefined, episode.releasesAt);
        const aberto = detalheId === episode.id;
        const painelId = `episodio-${episode.id}-detalhe`;
        const capaGrande = stillUrl(episode.stillPath, 'w300');

        return (
          <li
            key={episode.id}
            data-row
            className="episode"
            data-watched={watched}
            data-unaired={!aired}
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
                onClick={() => alternarDetalhe(episode.id)}
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

            {/*
              O título é o botão que abre os detalhes — é onde a mão já vai, e como <button> ele
              nasce alcançável por teclado e anuncia o estado sozinho. Um `onClick` na linha
              inteira pareceria igual e não faria nenhuma das duas coisas.
            */}
            <span className="episode__title">
              <button
                type="button"
                className="episode__open"
                aria-expanded={aberto}
                aria-controls={painelId}
                onClick={() => alternarDetalhe(episode.id)}
              >
                {episode.name ?? <span className="episode__untitled">Sem título</span>}
                <span className="sr-only">
                  {' '}
                  {formatEpisodeCode(episode.seasonNumber, episode.episodeNumber)} —{' '}
                  {aberto ? 'ocultar detalhes' : 'ver detalhes'}
                </span>
              </button>
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

            {/*
              Visto: quando. Não visto: desde quando está disponível — que é a informação útil
              nessa linha e substitui o "nunca" que ficava ali repetido temporada afora. Quando o
              episódio ainda não estreou, quem diz isso é o selo do fim da linha.
            */}
            <span className="episode__when">
              {watched
                ? formatWatchedAt(episode.lastWatchedAt)
                : aired
                  ? (quando ?? '')
                  : ''}
            </span>

            <span className="episode__actions">
              {/*
                Episódio que ainda não estreou não ganha botão de marcar — ganha a data. Um
                controle desabilitado convidaria a clicar e só então explicaria a recusa; a
                ausência dele, com o motivo escrito no lugar, resolve antes da tentativa.
              */}
              {aired ? (
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => onMark(episode)}
                  disabled={busy}
                >
                  {/*
                    O botão diz o que ACONTECE ao ser apertado. "Assisti"/"Revi" narrava em primeira
                    pessoa o que a pessoa tinha feito — vira uma frase no meio de uma barra de
                    ações, e não um comando.
                  */}
                  {watched ? 'Marcar de novo' : 'Marcar como visto'}
                  <span className="sr-only">
                    {' '}
                    {formatEpisodeCode(episode.seasonNumber, episode.episodeNumber)}
                  </span>
                </button>
              ) : (
                <span className="episode__soon">{quando}</span>
              )}

              {/*
                "Desmarcar" fica de pé mesmo no episódio não exibido, desde que haja o que
                desmarcar. É a saída para as exibições impossíveis que entraram antes da regra
                existir: sem ela, o dado errado ficaria visível e intocável.
              */}
              {watched ? (
                <button
                  type="button"
                  className="btn btn--quiet btn--danger"
                  onClick={() => onUnmark(episode)}
                  disabled={busy}
                >
                  Desmarcar
                  <span className="sr-only">
                    {' '}
                    {formatEpisodeCode(episode.seasonNumber, episode.episodeNumber)}
                  </span>
                </button>
              ) : null}
            </span>

            {/*
              O painel é um filho da MESMA grade da linha, ocupando todas as colunas — por isso o
              `grid-column: 1 / -1` no CSS. Pô-lo fora do <li> quebraria a lista (um <div> solto
              entre itens não é conteúdo de lista) e obrigaria a duplicar a borda de cada linha.
            */}
            {aberto ? (
              <div className="episode__detail" id={painelId}>
                {capaGrande ? (
                  <img
                    className="episode__detail-still"
                    src={capaGrande}
                    alt=""
                    loading="lazy"
                    width={300}
                    height={169}
                  />
                ) : null}

                <div className="episode__detail-text">
                  {/*
                    Sem sinopse não vai um espaço em branco: 19% dos episódios do acervo não têm
                    texto no TMDB, e um bloco vazio pareceria falha de carregamento. A frase diz
                    de quem é a lacuna.
                  */}
                  {episode.overview ? (
                    <p className="episode__overview">{episode.overview}</p>
                  ) : (
                    <p className="episode__overview episode__overview--empty">
                      O TMDB não tem sinopse para este episódio.
                    </p>
                  )}

                  <dl className="episode__facts">
                    <div>
                      <dt>Estreia</dt>
                      <dd>{quando ?? 'sem data'}</dd>
                    </div>
                    <div>
                      <dt>Duração</dt>
                      <dd className="tabular">{formatRuntime(episode.runtimeSeconds)}</dd>
                    </div>
                    <div>
                      <dt>Exibições</dt>
                      <dd className="tabular">{formatWatchCount(episode.watchCount)}</dd>
                    </div>
                    {watched ? (
                      <div>
                        <dt>Última vez</dt>
                        <dd>{formatWatchedAt(episode.lastWatchedAt)}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {/*
                    "Marcar até aqui" só existe aqui dentro: na linha ele disputaria espaço com os
                    dois botões que se usa o tempo todo, e é uma ação que se toma pensando — não de
                    passagem. O atalho A continua fazendo o mesmo sem abrir nada.
                  */}
                  {!episode.isSpecial && aired ? (
                    <button
                      type="button"
                      className="btn btn--quiet"
                      onClick={() => onMarkUpTo(episode)}
                      disabled={busy}
                    >
                      Marcar até aqui
                      <span className="sr-only">
                        {' '}
                        — todos os episódios até{' '}
                        {formatEpisodeCode(episode.seasonNumber, episode.episodeNumber)}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
