/*
 * ┌───────────────────────────────────────────────────────────────────────────────────────────┐
 * │  EXPERIMENTO TEMPORÁRIO — feito para ser apagado                                          │
 * └───────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Três desenhos alternativos para a tela "Próximos", escolhíveis em Ajustes, para decidir na mão
 * qual fica. Nada aqui é para durar.
 *
 * COMO REMOVER, quando a decisão estiver tomada (quatro passos, nenhum arqueológico):
 *
 *   1. Se a escolhida for uma das alternativas, mova o corpo dela para `app/(tabs)/index.tsx`,
 *      no lugar do desenho "prateleiras" que vive lá.
 *   2. Apague este arquivo.
 *   3. Em `app/(tabs)/index.tsx`: apague o import daqui, a chamada de `useHomeVariant()` e o
 *      `if (variante !== 'prateleiras')`. O que sobra é a tela.
 *   4. Em `app/ajustes.tsx`: apague a seção "Desenho da tela Próximos" (está marcada com o mesmo
 *      cabeçalho de EXPERIMENTO).
 *
 * O ajuste guardado em SQLite (`homeVariant`) pode ficar: chave órfã em tabela de configuração não
 * custa nada e some no próximo aparelho.
 *
 * As três alternativas respondem à MESMA pergunta — "o que eu assisto agora?" — de formas
 * deliberadamente distintas, para a comparação valer alguma coisa:
 *
 *   foco   uma resposta só, grande. Aposta que a pergunta tem UMA resposta certa.
 *   grade  reconhecimento pela capa, muitas na tela. Aposta que se escolhe pelo olho.
 *   lista  densidade máxima, sem imagem. Aposta que se escolhe pelo nome, varrendo.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { HomeShelf, formatEpisodeCode, formatWhen, posterUrl } from '@reprise/shared';
import type { NextUpItem } from '@reprise/shared';
import { useMarkEpisode } from '@/api/queries';
import { LocalStore } from '@/offline/local-store';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SETTING = 'homeVariant';

export type HomeVariantId = 'prateleiras' | 'foco' | 'grade' | 'lista';

export const HOME_VARIANTS: ReadonlyArray<{
  readonly id: HomeVariantId;
  readonly nome: string;
  readonly descricao: string;
}> = [
  {
    id: 'prateleiras',
    nome: 'Prateleiras',
    descricao: 'O desenho atual: saudação, "continuar assistindo", estreias e "em pausa".',
  },
  {
    id: 'foco',
    nome: 'Foco',
    descricao: 'Uma série em destaque, grande, e o resto numa lista discreta abaixo.',
  },
  {
    id: 'grade',
    nome: 'Grade de capas',
    descricao: 'Só pôsteres, três por linha, com o episódio marcado na capa.',
  },
  {
    id: 'lista',
    nome: 'Lista compacta',
    descricao: 'Uma linha por série, sem imagem. Cabe muita coisa sem rolar.',
  },
];

/** Lê e grava a variante escolhida. Começa em `prateleiras` até o disco responder. */
export function useHomeVariant(): [HomeVariantId, (id: HomeVariantId) => void] {
  const [variante, setVariante] = useState<HomeVariantId>('prateleiras');

  useEffect(() => {
    LocalStore.open().then(async (store) => {
      const salvo = await store.getSetting(SETTING);
      if (HOME_VARIANTS.some((v) => v.id === salvo)) setVariante(salvo as HomeVariantId);
    });
  }, []);

  const escolher = (id: HomeVariantId) => {
    setVariante(id);
    LocalStore.open().then((store) => store.setSetting(SETTING, id));
  };

  return [variante, escolher];
}

export interface HomeVariantProps {
  readonly items: readonly NextUpItem[];
  readonly nome?: string;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}

/** Despacha para a alternativa escolhida. `prateleiras` não passa por aqui — mora no index. */
export function HomeAlternativa({ id, ...props }: HomeVariantProps & { id: HomeVariantId }) {
  if (id === 'foco') return <Foco {...props} />;
  if (id === 'grade') return <Grade {...props} />;
  return <Lista {...props} />;
}

/** O botão de marcar, comum às três. Mostra progresso — marcar duas vezes registra duas exibições. */
function MarcarButton({ item, compacto = false }: { item: NextUpItem; compacto?: boolean }) {
  const t = useTheme();
  const mark = useMarkEpisode();
  const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);

  return (
    <Pressable
      onPress={() => mark.mutate(item.episode.id)}
      disabled={mark.isPending}
      style={[
        compacto ? s.marcarCompacto : s.marcar,
        { backgroundColor: t.accent, opacity: mark.isPending ? 0.6 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Marcar ${code} de ${item.seriesName} como visto`}
    >
      {mark.isPending ? (
        <ActivityIndicator size="small" color={t.accentFg} />
      ) : compacto ? (
        <Ionicons name="checkmark" size={20} color={t.accentFg} aria-hidden />
      ) : (
        <Text style={[s.marcarTexto, { color: t.accentFg }]}>Marcar como visto</Text>
      )}
    </Pressable>
  );
}

/* ─── foco ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * Uma resposta só.
 *
 * A série de atividade mais recente ocupa a dobra inteira, com capa grande e um botão que não
 * divide espaço com nada. O resto vira uma fila horizontal discreta — presente, sem competir.
 */
function Foco({ items, nome, refreshing, onRefresh }: HomeVariantProps) {
  const t = useTheme();
  const { emAndamento, emPausa } = HomeShelf.split(items);
  const fila = emAndamento.length > 0 ? emAndamento : emPausa;
  const [destaque, ...resto] = fila;

  if (!destaque) return <Vazio />;

  const code = formatEpisodeCode(destaque.episode.seasonNumber, destaque.episode.episodeNumber);
  const capa = posterUrl(destaque.posterPath, 'w342');

  return (
    <ScrollView
      contentContainerStyle={s.focoScroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[s.focoSaudacao, { color: t.fgMuted }]}>
        {HomeShelf.greeting()}
        {nome ? `, ${nome}` : ''}. Que tal continuar
      </Text>

      <Pressable onPress={() => router.push(`/series/${destaque.seriesId}`)}>
        {capa ? (
          <Image source={{ uri: capa }} style={s.focoCapa} contentFit="cover" transition={150} />
        ) : (
          <View style={[s.focoCapa, { backgroundColor: t.bgSunken }]} />
        )}
      </Pressable>

      <Text style={[s.focoTitulo, { color: t.fg }]}>{destaque.seriesName}</Text>
      <Text style={[s.focoEpisodio, { color: t.fgMuted }]}>
        {code}
        {destaque.episode.name ? ` · ${destaque.episode.name}` : ''}
      </Text>

      <MarcarButton item={destaque} />

      {resto.length > 0 ? (
        <>
          <Text style={[s.focoResto, { color: t.fgSubtle }]}>
            OU MAIS {resto.length} {resto.length === 1 ? 'SÉRIE' : 'SÉRIES'}
          </Text>
          <FlatList
            horizontal
            data={resto}
            keyExtractor={(i) => String(i.seriesId)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.focoFila}
            renderItem={({ item }) => {
              const mini = posterUrl(item.posterPath, 'w154');
              return (
                <Pressable
                  onPress={() => router.push(`/series/${item.seriesId}`)}
                  style={s.focoMini}
                  accessibilityRole="button"
                  accessibilityLabel={item.seriesName}
                >
                  {mini ? (
                    <Image source={{ uri: mini }} style={s.focoMiniCapa} contentFit="cover" />
                  ) : (
                    <View style={[s.focoMiniCapa, { backgroundColor: t.bgSunken }]} />
                  )}
                  <Text style={[s.focoMiniNome, { color: t.fgMuted }]} numberOfLines={2}>
                    {item.seriesName}
                  </Text>
                </Pressable>
              );
            }}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

/* ─── grade ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Escolher pelo olho.
 *
 * Três colunas, só capa, com o código do episódio sobreposto num rodapé escuro — que é o mínimo
 * para a grade responder "onde parei" e não virar um mural bonito e mudo.
 */
function Grade({ items, refreshing, onRefresh }: HomeVariantProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { emAndamento, emPausa } = HomeShelf.split(items);
  const todas = [...emAndamento, ...emPausa];

  const COLUNAS = 3;
  const largura = (width - Spacing[4] * 2 - Spacing[2] * (COLUNAS - 1)) / COLUNAS;

  if (todas.length === 0) return <Vazio />;

  return (
    <FlatList
      data={todas}
      numColumns={COLUNAS}
      keyExtractor={(i) => String(i.seriesId)}
      contentContainerStyle={s.gradeLista}
      columnWrapperStyle={s.gradeLinha}
      refreshing={refreshing}
      onRefresh={onRefresh}
      renderItem={({ item }) => {
        const capa = posterUrl(item.posterPath, 'w342');
        const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);

        return (
          <Pressable
            onPress={() => router.push(`/series/${item.seriesId}`)}
            style={[s.gradeItem, { width: largura }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.seriesName}, ${code}`}
          >
            <View style={[s.gradeCapaCaixa, { backgroundColor: t.bgSunken }]}>
              <Text style={[s.gradeInicial, { color: t.fgSubtle }]}>
                {item.seriesName.trim().charAt(0).toUpperCase()}
              </Text>
              {capa ? (
                <Image
                  source={{ uri: capa }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                  recyclingKey={String(item.seriesId)}
                />
              ) : null}
              <View style={s.gradeFaixa}>
                <Text style={s.gradeCodigo} numberOfLines={1}>
                  {code}
                </Text>
              </View>
            </View>
            <Text style={[s.gradeNome, { color: t.fgMuted }]} numberOfLines={2}>
              {item.seriesName}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

/* ─── lista ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Escolher pelo nome.
 *
 * Sem imagem nenhuma: cabem três vezes mais séries por tela, e o botão de marcar vira um ícone no
 * fim da linha. Aposta que quem já conhece o próprio acervo lê mais rápido do que reconhece.
 */
function Lista({ items, refreshing, onRefresh }: HomeVariantProps) {
  const t = useTheme();
  const { emAndamento, emPausa } = HomeShelf.split(items);
  const todas = [...emAndamento, ...emPausa];

  if (todas.length === 0) return <Vazio />;

  return (
    <FlatList
      data={todas}
      keyExtractor={(i) => String(i.seriesId)}
      contentContainerStyle={s.listaConteudo}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ItemSeparatorComponent={() => <View style={[s.listaSep, { backgroundColor: t.border }]} />}
      renderItem={({ item }) => {
        const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);
        return (
          <View style={s.listaLinha}>
            <Pressable
              style={s.listaTexto}
              onPress={() => router.push(`/series/${item.seriesId}`)}
              accessibilityRole="button"
              accessibilityLabel={item.seriesName}
            >
              <Text style={[s.listaNome, { color: t.fg }]} numberOfLines={1}>
                {item.seriesName}
              </Text>
              <Text style={[s.listaMeta, { color: t.fgSubtle }]} numberOfLines={1}>
                {code} · {formatWhen(item.lastActivityAt)}
              </Text>
            </Pressable>
            <MarcarButton item={item} compacto />
          </View>
        );
      }}
    />
  );
}

function Vazio() {
  const t = useTheme();
  return (
    <View style={s.vazio}>
      <Text style={[s.vazioTexto, { color: t.fgMuted }]}>
        Nada em aberto. Toda série que você acompanha está em dia.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  marcar: {
    minHeight: TouchTarget,
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  marcarCompacto: {
    width: TouchTarget,
    height: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  marcarTexto: { fontSize: FontSize.sm, fontWeight: '700' },

  focoScroll: { padding: Spacing[4], gap: Spacing[2], paddingBottom: Spacing[8] },
  focoSaudacao: { fontSize: FontSize.base },
  focoCapa: { width: '100%', aspectRatio: 2 / 3, borderRadius: Radius.lg, marginVertical: Spacing[2] },
  focoTitulo: { fontSize: FontSize.xl, fontWeight: '700' },
  focoEpisodio: { fontSize: FontSize.base, marginBottom: Spacing[2] },
  focoResto: { fontSize: FontSize.xs, letterSpacing: 1, marginTop: Spacing[5] },
  focoFila: { gap: Spacing[3], paddingVertical: Spacing[2] },
  focoMini: { width: 84, gap: Spacing[1] },
  focoMiniCapa: { width: 84, aspectRatio: 2 / 3, borderRadius: Radius.sm },
  focoMiniNome: { fontSize: FontSize.xs },

  gradeLista: { padding: Spacing[4], gap: Spacing[3] },
  gradeLinha: { gap: Spacing[2] },
  gradeItem: { gap: Spacing[1] },
  gradeCapaCaixa: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeInicial: { fontSize: FontSize.lg },
  gradeFaixa: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 2,
    paddingHorizontal: Spacing[1],
    // Preto sólido e não translúcido: sobre capa clara, um véu de 50% não garante contraste.
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  gradeCodigo: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700', textAlign: 'center' },
  gradeNome: { fontSize: FontSize.xs },

  listaConteudo: { paddingVertical: Spacing[2], paddingBottom: Spacing[8] },
  listaSep: { height: StyleSheet.hairlineWidth, marginLeft: Spacing[4] },
  listaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  listaTexto: { flex: 1, minWidth: 0, minHeight: TouchTarget, justifyContent: 'center' },
  listaNome: { fontSize: FontSize.base, fontWeight: '600' },
  listaMeta: { fontSize: FontSize.sm },

  vazio: { padding: Spacing[6] },
  vazioTexto: { fontSize: FontSize.base, lineHeight: 22 },
});
