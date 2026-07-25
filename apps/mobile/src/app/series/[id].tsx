import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  OutboxPlanner,
  SeriesCompletion,
  formatEpisodeCode,
  formatPercent,
  formatRuntime,
  formatSeriesStatus,
  formatWatchCount,
  posterUrl,
} from '@reprise/shared';
import type { Episode, ProjectableEpisode, Season, SeriesDetail } from '@reprise/shared';
import {
  useMarkEpisode,
  useMarkSeason,
  useMarkUpTo,
  usePendingActions,
  useSeriesDetail,
  useUnmarkEpisode,
} from '@/api/queries';
import { QueryState } from '@/components/query-state';
import { CompletionBadge, ProgressBar } from '@/components/series-card';
import { SyncBar } from '@/components/sync-bar';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useTheme } from '@/hooks/use-theme';

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seriesId = Number(id);
  const t = useTheme();
  const status = useAutoSync();
  const query = useSeriesDetail(seriesId);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <SyncBar status={status} />
      <QueryState query={query}>
        {(series) => (
          <>
            <Stack.Screen options={{ title: series.name }} />
            <Detail series={series} />
          </>
        )}
      </QueryState>
    </View>
  );
}

function Detail({ series }: { series: SeriesDetail }) {
  const t = useTheme();
  const pending = usePendingActions();
  const markUpTo = useMarkUpTo(series.id);

  /**
   * O número que aparece na tela é o do servidor **mais** o que ainda está na fila.
   *
   * Sem isso, tocar "assisti" sem rede não mudaria nada visualmente e o app pareceria quebrado.
   * A projeção é descartável de propósito: assim que a fila esvazia, quem manda volta a ser a
   * contagem derivada pelo servidor — o app nunca guarda um "assistido" próprio.
   */
  const projected = useMemo(() => {
    const flat: ProjectableEpisode[] = series.seasons.flatMap((s) =>
      s.episodes.map((e) => ({
        id: e.id,
        seriesId: series.id,
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        watchCount: e.watchCount,
      })),
    );
    return OutboxPlanner.project(flat, pending.data ?? []);
  }, [series, pending.data]);

  const countOf = (e: Episode) => projected.get(e.id) ?? e.watchCount;

  const watched = series.seasons.reduce(
    (n, s) => n + s.episodes.filter((e) => !e.isSpecial && countOf(e) > 0).length,
    0,
  );
  const total = series.episodesTotal;
  const ratio = total > 0 ? watched / total : 0;
  const peak = series.seasons.reduce(
    (max, s) => Math.max(max, ...s.episodes.map((e) => countOf(e))),
    0,
  );

  const completion = SeriesCompletion.of({
    productionStatus: series.productionStatus,
    episodesTotal: total,
    episodesWatched: watched,
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {posterUrl(series.posterPath, 'w342') ? (
          <Image
            source={posterUrl(series.posterPath, 'w342')}
            style={styles.headerPoster}
            contentFit="cover"
            transition={150}
          />
        ) : null}
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: t.fg }]}>{series.name}</Text>
          {series.originalName && series.originalName !== series.name ? (
            <Text style={[styles.original, { color: t.fgSubtle }]}>{series.originalName}</Text>
          ) : null}
          <Text style={[styles.meta, { color: t.fgMuted }]}>
            {formatSeriesStatus(series.status)} · {watched}/{total} · {formatPercent(ratio)}
          </Text>

          {/* Conclusão calculada sobre a contagem PROJETADA: marcar sem rede já muda o selo. */}
          <View style={styles.completionRow}>
            <CompletionBadge completion={completion} />
            <Text style={[styles.completionLabel, { color: t.fgSubtle }]} numberOfLines={2}>
              {completion.label}
            </Text>
          </View>

          <ProgressBar completion={completion} theme={t} height={4} />
        </View>
      </View>

      {series.overview ? (
        <Text style={[styles.overview, { color: t.fgMuted }]}>{series.overview}</Text>
      ) : null}

      {series.seasons.map((season) => (
        <SeasonBlock
          key={season.seasonNumber}
          season={season}
          seriesId={series.id}
          countOf={countOf}
          peak={peak}
          onMarkUpTo={(e) =>
            markUpTo.mutate({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })
          }
        />
      ))}
    </ScrollView>
  );
}

function SeasonBlock({
  season,
  seriesId,
  countOf,
  peak,
  onMarkUpTo,
}: {
  season: Season;
  seriesId: number;
  countOf: (e: Episode) => number;
  peak: number;
  onMarkUpTo: (e: Episode) => void;
}) {
  const t = useTheme();
  const markSeason = useMarkSeason(seriesId);
  const unseen = season.episodes.filter((e) => countOf(e) === 0).length;

  return (
    <View style={styles.season}>
      <View style={[styles.seasonHead, { borderBottomColor: t.border }]}>
        <Text style={[styles.seasonTitle, { color: t.fg }]}>
          {season.isSpecials ? 'Especiais' : `Temporada ${season.seasonNumber}`}
        </Text>

        {unseen > 0 ? (
          <Pressable
            onPress={() => markSeason.mutate(season.seasonNumber)}
            disabled={markSeason.isPending}
            style={[styles.seasonAction, { borderColor: t.borderStrong }]}
            accessibilityRole="button"
            accessibilityLabel={`Marcar os ${unseen} episódios não vistos da ${season.isSpecials ? 'lista de especiais' : `temporada ${season.seasonNumber}`}`}
          >
            <Text style={[styles.seasonActionText, { color: t.fg }]}>Marcar {unseen}</Text>
          </Pressable>
        ) : null}
      </View>

      {season.episodes.map((episode) => (
        <EpisodeRow
          key={episode.id}
          episode={episode}
          count={countOf(episode)}
          peak={peak}
          onMarkUpTo={() => onMarkUpTo(episode)}
        />
      ))}
    </View>
  );
}

function EpisodeRow({
  episode,
  count,
  peak,
  onMarkUpTo,
}: {
  episode: Episode;
  count: number;
  peak: number;
  onMarkUpTo: () => void;
}) {
  const t = useTheme();
  const mark = useMarkEpisode();
  const unmark = useUnmarkEpisode();
  const [open, setOpen] = useState(false);

  const watched = count > 0;
  // A altura do bloco é relativa ao pico DESTA série, igual ao web: numa série vista 17 vezes,
  // uma exibição precisa parecer pouco.
  const level = watched ? Math.max(1, Math.ceil((count / Math.max(1, peak)) * 4)) : 0;
  const color = watched ? t.track[level - 1] ?? t.accent : t.trackEmpty;
  const code = formatEpisodeCode(episode.seasonNumber, episode.episodeNumber);

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        onLongPress={() => mark.mutate(episode.id)}
        style={[styles.episodeRow, { borderBottomColor: t.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${code}${episode.name ? `, ${episode.name}` : ''}. ${formatWatchCount(count)}. Toque para ações.`}
      >
        {/* Marca de estado: cor E contorno tracejado no não visto — nunca só a cor. */}
        <View
          style={[
            styles.chip,
            {
              backgroundColor: watched ? color : 'transparent',
              borderColor: watched ? color : t.borderStrong,
              borderStyle: watched ? 'solid' : 'dashed',
            },
          ]}
        />

        <View style={styles.episodeText}>
          <Text style={[styles.episodeName, { color: t.fg }]} numberOfLines={1}>
            <Text style={styles.code}>{code}</Text>
            {episode.name ? `  ${episode.name}` : ''}
          </Text>
          <Text style={[styles.episodeMeta, { color: t.fgSubtle }]}>
            {formatRuntime(episode.runtimeSeconds)}
            {count > 1 ? ` · ${count}×` : ''}
          </Text>
        </View>

        {/* O número de exibições também em texto: o estado nunca depende só do bloco colorido. */}
        <Text style={[styles.count, { color: watched ? t.fg : t.fgSubtle }]}>
          {watched ? `${count}×` : '—'}
        </Text>
      </Pressable>

      {open ? (
        <View style={[styles.actions, { backgroundColor: t.bgSunken }]}>
          <Action
            label={watched ? 'Assisti de novo' : 'Assisti'}
            onPress={() => mark.mutate(episode.id)}
            accent
          />
          {watched ? (
            <Action label="Desmarcar" onPress={() => unmark.mutate(episode.id)} />
          ) : null}
          {!episode.isSpecial ? <Action label="Marcar até aqui" onPress={onMarkUpTo} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Action({
  label,
  onPress,
  accent = false,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.action,
        accent
          ? { backgroundColor: t.accent }
          : { backgroundColor: 'transparent', borderColor: t.borderStrong, borderWidth: 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.actionText, { color: accent ? t.accentFg : t.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: Spacing[8] },

  header: { flexDirection: 'row', gap: Spacing[4], padding: Spacing[4] },
  headerPoster: { width: 92, height: 138, borderRadius: Radius.md },
  headerText: { flex: 1, gap: Spacing[1] },
  name: { fontSize: FontSize.lg, fontWeight: '700' },
  original: { fontSize: FontSize.sm },
  meta: { fontSize: FontSize.sm, marginTop: Spacing[1] },
  completionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: Spacing[2] },
  completionLabel: { flex: 1, fontSize: FontSize.xs },
  overview: { paddingHorizontal: Spacing[4], fontSize: FontSize.sm, lineHeight: 21 },

  season: { marginTop: Spacing[5] },
  seasonHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: TouchTarget,
  },
  seasonTitle: { fontSize: FontSize.base, fontWeight: '700' },
  seasonAction: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    minHeight: 40,
    justifyContent: 'center',
  },
  seasonActionText: { fontSize: FontSize.sm, fontWeight: '600' },

  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    minHeight: TouchTarget,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: { width: 10, height: 26, borderRadius: Radius.sm, borderWidth: 1 },
  episodeText: { flex: 1 },
  episodeName: { fontSize: FontSize.sm },
  code: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  episodeMeta: { fontSize: FontSize.xs, marginTop: 1 },
  count: { fontSize: FontSize.sm, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], padding: Spacing[3] },
  action: {
    minHeight: TouchTarget,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: FontSize.sm, fontWeight: '700' },
});
