import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { formatPercent, formatSeriesStatus, formatWatchedAt, posterUrl } from '@reprise/shared';
import type { SeriesListItem } from '@reprise/shared';
import { useSeriesList } from '@/api/queries';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useTheme } from '@/hooks/use-theme';

/**
 * O acervo. Linha compacta, não grade de pôsteres: com 115 séries, o que se procura é um nome,
 * e nome se lê em lista. O pôster fica como âncora visual pequena.
 *
 * A busca filtra localmente — o acervo inteiro já está em memória e em cache, então mandar uma
 * consulta ao servidor a cada tecla seria trabalho de rede para responder o que já se sabe.
 */
export default function SeriesScreen() {
  const t = useTheme();
  const status = useAutoSync();
  const query = useSeriesList();
  const [term, setTerm] = useState('');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {(all) => <SeriesList all={all} term={term} setTerm={setTerm} loading={query.isFetching} onRefresh={query.refetch} />}
      </QueryState>
    </SafeAreaView>
  );
}

function SeriesList({
  all,
  term,
  setTerm,
  loading,
  onRefresh,
}: {
  all: SeriesListItem[];
  term: string;
  setTerm: (v: string) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const t = useTheme();

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((s) => s.name.toLowerCase().includes(needle));
  }, [all, term]);

  return (
    <FlatList
      data={shown}
      keyExtractor={(s) => String(s.id)}
      contentContainerStyle={styles.list}
      refreshing={loading}
      onRefresh={onRefresh}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={[styles.eyebrow, { color: t.fgSubtle }]}>ACERVO</Text>
          <Text style={[styles.title, { color: t.fg }]}>
            {all.length} {all.length === 1 ? 'série' : 'séries'}
          </Text>
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="Buscar por nome"
            placeholderTextColor={t.fgSubtle}
            style={[
              styles.search,
              { color: t.fg, borderColor: t.borderStrong, backgroundColor: t.bgRaised },
            ]}
            accessibilityLabel="Buscar série por nome"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: t.fgMuted }]}>Nenhuma série com esse nome.</Text>
      }
      renderItem={({ item }) => <SeriesRow item={item} />}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.border }]} />}
    />
  );
}

function SeriesRow({ item }: { item: SeriesListItem }) {
  const t = useTheme();
  const poster = posterUrl(item.posterPath, 'w154');
  const complete = item.completionRatio >= 1;

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/series/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. ${item.episodesWatched} de ${item.episodesTotal} episódios, ${formatPercent(item.completionRatio)}. ${formatSeriesStatus(item.status)}.`}
    >
      {poster ? (
        <Image source={poster} style={styles.poster} contentFit="cover" transition={120} />
      ) : (
        <View style={[styles.poster, { backgroundColor: t.bgSunken }]} />
      )}

      <View style={styles.rowText}>
        <Text style={[styles.name, { color: t.fg }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.meta, { color: t.fgMuted }]}>
          {item.episodesWatched}/{item.episodesTotal} · {formatSeriesStatus(item.status)}
        </Text>
        <Text style={[styles.meta, { color: t.fgSubtle }]}>
          {formatWatchedAt(item.lastWatchedAt)}
        </Text>

        {/* Barra de progresso com o número ao lado: a cor/comprimento nunca é o único canal. */}
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: t.trackEmpty }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: complete ? t.accent : t.track[1],
                  width: `${Math.round(item.completionRatio * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.percent, { color: t.fgMuted }]}>
            {formatPercent(item.completionRatio)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: Spacing[8] },
  head: { paddingHorizontal: Spacing[4], paddingTop: Spacing[5], paddingBottom: Spacing[4], gap: Spacing[3] },
  eyebrow: { fontSize: FontSize.xs, letterSpacing: 1.2, fontWeight: '700' },
  title: { fontSize: FontSize.xl, fontWeight: '700' },
  search: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    fontSize: FontSize.base,
    minHeight: TouchTarget,
  },
  empty: { padding: Spacing[4], fontSize: FontSize.base },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing[4] },

  row: {
    flexDirection: 'row',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    minHeight: TouchTarget,
    alignItems: 'center',
  },
  poster: { width: 44, height: 66, borderRadius: Radius.sm },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.base, fontWeight: '700' },
  meta: { fontSize: FontSize.xs },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: Spacing[1] },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' },
  percent: { fontSize: FontSize.xs, fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'right' },
});
