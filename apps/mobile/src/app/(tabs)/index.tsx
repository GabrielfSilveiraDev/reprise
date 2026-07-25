import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { formatEpisodeCode, formatWatchedAt, posterUrl } from '@reprise/shared';
import type { NextUpItem } from '@reprise/shared';
import { useMarkEpisode, useNextUp, usePremieres } from '@/api/queries';
import { PremiereStrip } from '@/components/premiere-strip';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useTheme } from '@/hooks/use-theme';

/**
 * A tela que abre o app: o que assistir agora.
 *
 * É a razão de o app existir no celular — no sofá ninguém quer navegar um acervo de 115 séries
 * para descobrir onde parou. Cada linha traz o botão de marcar direto, sem entrar no detalhe.
 */
export default function NextUpScreen() {
  const t = useTheme();
  const status = useAutoSync();
  const query = useNextUp();
  // Falha em silêncio de propósito: sem estreias a faixa não aparece, e não ter estreias não é
  // motivo para a tela principal mostrar erro.
  const premieres = usePremieres();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.seriesId)}
            contentContainerStyle={styles.list}
            refreshing={query.isFetching}
            onRefresh={() => query.refetch()}
            ListHeaderComponent={
              <View>
                <PremiereStrip premieres={premieres.data ?? []} />
                <View style={styles.head}>
                  <Text style={[styles.eyebrow, { color: t.fgSubtle }]}>PRÓXIMOS</Text>
                  <Text style={[styles.title, { color: t.fg }]}>Onde você parou</Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <Text style={[styles.empty, { color: t.fgMuted }]}>
                Nada pendente. Toda série acompanhada está em dia.
              </Text>
            }
            renderItem={({ item }) => <NextUpRow item={item} />}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: t.border }]} />
            )}
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}

function NextUpRow({ item }: { item: NextUpItem }) {
  const t = useTheme();
  const mark = useMarkEpisode();
  const poster = posterUrl(item.posterPath, 'w154');
  const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.rowMain}
        onPress={() => router.push(`/series/${item.seriesId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.seriesName}, próximo episódio ${code}. Abrir detalhes.`}
      >
        {poster ? (
          <Image source={poster} style={styles.poster} contentFit="cover" transition={120} />
        ) : (
          <View style={[styles.poster, { backgroundColor: t.bgSunken }]} />
        )}

        <View style={styles.rowText}>
          <Text style={[styles.seriesName, { color: t.fg }]} numberOfLines={2}>
            {item.seriesName}
          </Text>
          <Text style={[styles.episode, { color: t.fgMuted }]} numberOfLines={2}>
            {code}
            {item.episode.name ? ` · ${item.episode.name}` : ''}
          </Text>
          <Text style={[styles.meta, { color: t.fgSubtle }]}>
            {formatWatchedAt(item.lastActivityAt)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => mark.mutate(item.episode.id)}
        disabled={mark.isPending}
        style={[
          styles.markButton,
          { backgroundColor: t.accent, opacity: mark.isPending ? 0.6 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Marcar ${code} de ${item.seriesName} como assistido`}
      >
        <Text style={[styles.markLabel, { color: t.accentFg }]}>Assisti</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: Spacing[8] },
  head: { paddingHorizontal: Spacing[4], paddingTop: Spacing[5], paddingBottom: Spacing[4] },
  eyebrow: { fontSize: FontSize.xs, letterSpacing: 1.2, fontWeight: '700' },
  title: { fontSize: FontSize.xl, fontWeight: '700', marginTop: Spacing[1] },
  empty: { padding: Spacing[4], fontSize: FontSize.base, lineHeight: 22 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing[4] },

  row: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing[4] },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing[3],
    padding: Spacing[3],
    paddingLeft: Spacing[4],
    minHeight: TouchTarget,
    alignItems: 'center',
  },
  poster: { width: 44, height: 66, borderRadius: Radius.sm },
  rowText: { flex: 1, gap: 2 },
  seriesName: { fontSize: FontSize.base, fontWeight: '700' },
  episode: { fontSize: FontSize.sm },
  meta: { fontSize: FontSize.xs },

  markButton: {
    minHeight: TouchTarget,
    minWidth: 84,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[3],
  },
  markLabel: { fontSize: FontSize.sm, fontWeight: '700' },
});
