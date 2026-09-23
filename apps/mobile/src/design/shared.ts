/**
 * A lógica que os quatro designs compartilham, sem uma linha de aparência.
 *
 * <b>Por que isto existe.</b> Cada design refaz a COMPOSIÇÃO das telas — é essa a promessa. Mas
 * "quantos episódios faltam nesta temporada", "some as marcações que ainda estão na fila offline"
 * e "espere o usuário parar de digitar antes de bater no TMDB" não são decisões de desenho: são as
 * regras do app. Escritas quatro vezes, elas divergem no dia em que alguém corrige um bug em três
 * delas — e o quarto design passa a mentir um número.
 *
 * <b>A fronteira.</b> Nada aqui devolve JSX ou lê tokens. Estes ganchos devolvem NÚMEROS e
 * ESTADO; como isso vira tela é o que distingue um design do outro, e mora em cada pasta.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Airing,
  OutboxPlanner,
  SeriesCompletion,
  posterUrl,
} from '@reprise/shared';
import type {
  Episode,
  ProjectableEpisode,
  Season,
  SeriesDetail,
  SeriesListItem,
} from '@reprise/shared';
import { Auth } from '@/api/auth';
import { usePendingActions, useSeriesList, useSeriesSearch } from '@/api/queries';
import { LocalStore } from '@/offline/local-store';

/* ── erro ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * O texto de um erro de consulta.
 *
 * As camadas de baixo já traduzem o ProblemDetails da API para a mensagem do `Error` — o que falta
 * é não deixar escapar um `[object Object]` quando o que chega não é um `Error`, que foi
 * exatamente o que a tela de busca chegou a mostrar.
 */
export function textoDoErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === 'string') return erro;
  return 'Erro desconhecido.';
}

/* ── sair ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * Sair da conta, avisando quando há coisa na fila.
 *
 * As ações pendentes ficam no SQLite do aparelho e não sobem sem sessão — descobrir isso depois
 * seria descobrir tarde. O alerta é do sistema de propósito: é a única interrupção do app, e uma
 * caixa desenhada por nós pareceria menos séria do que ela precisa parecer.
 */
export function useSair(): () => void {
  // `usePendingActions` e não `useAutoSync`: as telas já chamam o segundo para a barra de
  // sincronização, e ele guarda por instância a transição offline→online que dispara o flush.
  // Uma segunda instância aqui daria duas descargas da fila a cada reconexão. Esta é só a
  // consulta, que o react-query deduplica pela chave.
  const pending = usePendingActions();
  const qc = useQueryClient();

  return () => {
    const seguir = async () => {
      await Auth.logout();
      qc.clear();
      router.replace('/login');
    };

    const pendentes = pending.data?.length ?? 0;
    if (pendentes === 0) {
      void seguir();
      return;
    }

    Alert.alert(
      'Sair com marcações pendentes?',
      `${pendentes} ${pendentes === 1 ? 'marcação ainda não chegou' : 'marcações ainda não chegaram'} ao servidor. Elas ficam guardadas neste aparelho até você entrar de novo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair mesmo assim', style: 'destructive', onPress: () => void seguir() },
      ],
    );
  };
}

/* ── acervo ────────────────────────────────────────────────────────────────────────────────── */

export type FiltroAcervo = 'all' | 'unfinished' | 'finished';

export function acervoConcluido(s: SeriesListItem): boolean {
  return SeriesCompletion.of({
    productionStatus: s.productionStatus,
    episodesTotal: s.episodesTotal,
    episodesWatched: s.episodesWatched,
  }).isFinished;
}

/**
 * O acervo filtrado, com a escolha guardada no aparelho.
 *
 * <b>A chave do ajuste é por design.</b> Cada um oferece opções diferentes — o cinematográfico não
 * tem "lista", o painel não tem "pôsteres" —, e uma chave única faria o valor salvo por um design
 * chegar sem sentido no outro. Guardar separado é o que permite trocar de design e voltar
 * encontrando cada um como você o deixou.
 */
export function useAcervo(chaveDoFiltro: string) {
  const query = useSeriesList();
  const [termo, setTermo] = useState('');
  const [filtro, setFiltro] = useState<FiltroAcervo>('all');

  useEffect(() => {
    let vivo = true;
    LocalStore.open()
      .then((store) => store.getSetting(chaveDoFiltro))
      .then((salvo) => {
        if (!vivo) return;
        if (salvo === 'all' || salvo === 'unfinished' || salvo === 'finished') setFiltro(salvo);
      })
      .catch(() => {
        // Preferência é conveniência, não requisito: sem banco local, segue no padrão.
      });
    return () => {
      vivo = false;
    };
  }, [chaveDoFiltro]);

  const escolherFiltro = (f: FiltroAcervo) => {
    setFiltro(f);
    void LocalStore.open().then((store) => store.setSetting(chaveDoFiltro, f));
  };

  const todas = query.data ?? [];

  const vistas = useMemo(() => {
    const agulha = termo.trim().toLowerCase();
    return todas.filter((s) => {
      if (agulha && !s.name.toLowerCase().includes(agulha)) return false;
      if (filtro === 'all') return true;
      return filtro === 'finished' ? acervoConcluido(s) : !acervoConcluido(s);
    });
  }, [todas, termo, filtro]);

  const finalizadas = useMemo(() => todas.filter(acervoConcluido).length, [todas]);

  return { query, todas, vistas, termo, setTermo, filtro, escolherFiltro, finalizadas };
}

/* ── busca ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * O termo, alguns instantes depois de parar de digitar.
 *
 * Num teclado de celular cada letra é um evento, e cada busca custa duas requisições ao TMDB no
 * servidor. Sem o atraso, "severance" viraria dezoito requisições para chegar ao mesmo resultado
 * da última tecla.
 */
function useAtrasado(valor: string, ms = 400): string {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);

  return atrasado;
}

/**
 * Busca de séries novas, com as capas adiantadas.
 *
 * <b>O `prefetch` não é enfeite.</b> A FlatList só monta o que está visível, então sem ele a capa
 * do sétimo resultado só começa a baixar quando você rola até lá — e aí você paga de novo o aperto
 * de mão TLS que já pagou no primeiro. Disparando tudo junto, a conexão com o CDN se estabelece
 * uma vez e as demais descem por ela enquanto você lê o primeiro resultado. São ~7 KB por capa e
 * no máximo 20 por busca.
 */
export function useBusca(tamanhoDaCapa: 'w154' | 'w342' = 'w154') {
  const [termo, setTermo] = useState('');
  const buscado = useAtrasado(termo);
  const query = useSeriesSearch(buscado);
  const curto = buscado.trim().length < 2;

  useEffect(() => {
    const capas = (query.data ?? [])
      .map((r) => posterUrl(r.posterPath, tamanhoDaCapa))
      .filter((u): u is string => Boolean(u));

    // Sem `await` e sem tratar falha: é adiantamento, não requisito. Falhando, o componente pede a
    // imagem normalmente quando a linha aparece.
    if (capas.length > 0) void Image.prefetch(capas, { cachePolicy: 'memory-disk' });
  }, [query.data, tamanhoDaCapa]);

  return { termo, setTermo, query, curto };
}

/* ── detalhe ───────────────────────────────────────────────────────────────────────────────── */

export interface DetalheDerivado {
  /** A contagem de exibições do episódio, já somada ao que ainda está na fila offline. */
  readonly contar: (e: Episode) => number;
  readonly assistidos: number;
  readonly total: number;
  readonly ratio: number;
  /** O maior número de exibições da série — a escala da rampa de rewatch. */
  readonly pico: number;
  readonly completion: SeriesCompletion;
  /** A temporada que a tela deve abrir sozinha. */
  readonly temporadaInicial: number | undefined;
}

/**
 * Os números do detalhe, projetando a fila offline.
 *
 * O que aparece na tela é o do servidor **mais** o que ainda não subiu. Sem isso, tocar "assisti"
 * sem rede não mudaria nada visualmente e o app pareceria quebrado. A projeção é descartável de
 * propósito: quando a fila esvazia, quem manda volta a ser a contagem do servidor — o app nunca
 * guarda um "assistido" próprio.
 */
export function useDetalhe(series: SeriesDetail): DetalheDerivado {
  const pending = usePendingActions();

  const projetado = useMemo(() => {
    const plano: ProjectableEpisode[] = series.seasons.flatMap((s) =>
      s.episodes.map((e) => ({
        id: e.id,
        seriesId: series.id,
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        watchCount: e.watchCount,
      })),
    );
    return OutboxPlanner.project(plano, pending.data ?? []);
  }, [series, pending.data]);

  return useMemo(() => {
    const contar = (e: Episode) => projetado.get(e.id) ?? e.watchCount;

    const assistidos = series.seasons.reduce(
      (n, s) => n + s.episodes.filter((e) => !e.isSpecial && contar(e) > 0).length,
      0,
    );
    const total = series.episodesTotal;
    const pico = series.seasons.reduce(
      (max, s) => Math.max(max, ...s.episodes.map((e) => contar(e))),
      0,
    );

    const completion = SeriesCompletion.of({
      productionStatus: series.productionStatus,
      episodesTotal: total,
      // Sem isto, série com temporada anunciada aparece devendo episódios que ainda não existem.
      episodesAired: series.episodesAired,
      episodesWatched: assistidos,
    });

    // A primeira temporada regular com episódio por assistir. Especiais nunca disputam o posto:
    // ninguém retoma uma série por um especial.
    const temporadaInicial =
      series.seasons.find((s) => !s.isSpecials && s.episodes.some((e) => contar(e) === 0))
        ?.seasonNumber ??
      series.seasons.find((s) => !s.isSpecials)?.seasonNumber ??
      series.seasons[0]?.seasonNumber;

    return {
      contar,
      assistidos,
      total,
      ratio: total > 0 ? assistidos / total : 0,
      pico,
      completion,
      temporadaInicial,
    };
  }, [series, projetado]);
}

/** Os números de uma temporada. Puro, para não obrigar cada design a recontar do mesmo jeito. */
export class ContagemDaTemporada {
  private constructor(
    readonly nome: string,
    readonly total: number,
    readonly assistidos: number,
    /** Não vistos E já exibidos — o que "Marcar N" pode de fato marcar. */
    readonly porAssistir: number,
    readonly porVir: number,
  ) {}

  static of(season: Season, contar: (e: Episode) => number): ContagemDaTemporada {
    return new ContagemDaTemporada(
      season.isSpecials ? 'Especiais' : `Temporada ${season.seasonNumber}`,
      season.episodes.length,
      season.episodes.filter((e) => contar(e) > 0).length,
      // "Marcar 6" numa temporada com quatro episódios agendados prometeria seis, e o servidor
      // criaria dois.
      season.episodes.filter((e) => contar(e) === 0 && Airing.hasReleased(e.releasesAt, e.airDate))
        .length,
      season.episodes.filter((e) => !Airing.hasReleased(e.releasesAt, e.airDate)).length,
    );
  }

  /** O sufixo honesto do cabeçalho: nada a fazer, mais a caminho, ou completa. */
  get resumo(): string {
    if (this.porAssistir > 0) return '';
    if (this.porVir > 0) return ` · mais ${this.porVir} a caminho`;
    return ' · completa';
  }

  get completa(): boolean {
    return this.total > 0 && this.assistidos === this.total;
  }
}
