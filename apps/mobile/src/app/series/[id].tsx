import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Airing,
  OutboxPlanner,
  SeriesCompletion,
  formatEpisodeCode,
  formatPercent,
  formatRuntime,
  formatSeriesStatus,
  formatWatchCount,
  posterUrl,
  SERIES_STATUSES,
} from '@reprise/shared';
import type { Episode, ProjectableEpisode, Season, SeriesDetail } from '@reprise/shared';
import {
  useMarkEpisode,
  useMarkSeason,
  useMarkUpTo,
  usePendingActions,
  useSeriesDetail,
  useSetSeriesStatus,
  useUnmarkEpisode,
} from '@/api/queries';
import { QueryState } from '@/components/query-state';
import { EpisodeRow } from '@/components/episode-row';
import { RewatchSessions } from '@/components/rewatch-sessions';
import { CompletionBadge, ProgressBar } from '@/components/series-card';
import { SyncBar } from '@/components/sync-bar';
import { EyebrowStyle, FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
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
    // Sem isto, uma série com temporada anunciada aparece devendo episódios que ainda não existem.
    episodesAired: series.episodesAired,
    episodesWatched: watched,
  });

  // A primeira temporada regular com episódio por assistir. Especiais nunca disputam esse posto:
  // ninguém retoma uma série por um especial.
  const seasonToOpen =
    series.seasons.find((s) => !s.isSpecials && s.episodes.some((e) => countOf(e) === 0))
      ?.seasonNumber ??
    series.seasons.find((s) => !s.isSpecials)?.seasonNumber ??
    series.seasons[0]?.seasonNumber;

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

      <StatusPicker seriesId={series.id} current={series.status} />

      {/* Antes das temporadas: "quantas vezes eu percorri isto" vem antes de "onde eu estou
          nesta passada". Mesma ordem do web. */}
      <RewatchSessions
        sessions={series.sessions}
        backfillExhibitions={series.backfillExhibitions}
      />

      {/*
        Uma temporada aberta, o resto fechado. Séries longas — Two and a Half Men tem 262
        episódios em 12 temporadas — viravam uma rolagem infinita em que achar onde você parou
        custava mais do que marcar. Abrir sozinha a temporada do próximo episódio responde à
        pergunta com que se entra na tela; se não há próximo (série terminada), abre a primeira.
      */}
      {series.seasons.map((season) => (
        <SeasonBlock
          key={season.seasonNumber}
          season={season}
          seriesId={series.id}
          countOf={countOf}
          peak={peak}
          initiallyOpen={season.seasonNumber === seasonToOpen}
          onMarkUpTo={(e) =>
            markUpTo.mutate({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })
          }
        />
      ))}
    </ScrollView>
  );
}

/**
 * Estado de acompanhamento. Fica no detalhe porque é uma decisão sobre a série inteira, e é o
 * que tira uma série de "Próximos" sem apagar um único evento do histórico.
 */
function StatusPicker({ seriesId, current }: { seriesId: number; current: string }) {
  const t = useTheme();
  const setStatus = useSetSeriesStatus();

  return (
    <View style={styles.statusBlock}>
      <Text style={[styles.statusTitle, { color: t.fgSubtle }]}>Estado</Text>
      <View style={styles.statusRow}>
        {SERIES_STATUSES.map((status) => {
          const active = status === current;
          return (
            <Pressable
              key={status}
              onPress={() => setStatus.mutate({ seriesId, status })}
              disabled={active || setStatus.isPending}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Marcar como ${formatSeriesStatus(status)}`}
              style={[
                styles.statusChip,
                {
                  backgroundColor: active ? t.accentQuiet : 'transparent',
                  borderColor: active ? t.accent : t.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: active ? t.fg : t.fgMuted, fontWeight: active ? '700' : '500' },
                ]}
              >
                {formatSeriesStatus(status)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Liga a linha às mutações. Existe para que os hooks fiquem por episódio, não por temporada. */
function SeasonEpisode({
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
  const mark = useMarkEpisode();
  const unmark = useUnmarkEpisode();

  return (
    <EpisodeRow
      episode={episode}
      count={count}
      peak={peak}
      onMark={() => mark.mutate(episode.id)}
      onUnmark={() => unmark.mutate(episode.id)}
      onMarkUpTo={onMarkUpTo}
    />
  );
}

function SeasonBlock({
  season,
  seriesId,
  countOf,
  peak,
  initiallyOpen,
  onMarkUpTo,
}: {
  season: Season;
  seriesId: number;
  countOf: (e: Episode) => number;
  peak: number;
  initiallyOpen: boolean;
  onMarkUpTo: (e: Episode) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const markSeason = useMarkSeason(seriesId);

  const total = season.episodes.length;
  const watched = season.episodes.filter((e) => countOf(e) > 0).length;
  // Só o que dá para marcar: não visto E já exibido. "Marcar 6" numa temporada com quatro
  // episódios agendados prometeria seis e o servidor criaria dois.
  const unseen = season.episodes.filter(
    (e) => countOf(e) === 0 && Airing.hasAired(e.airDate),
  ).length;
  const porVir = season.episodes.filter((e) => !Airing.hasAired(e.airDate)).length;
  const nome = season.isSpecials ? 'Especiais' : `Temporada ${season.seasonNumber}`;

  return (
    <View style={styles.season}>
      <View style={[styles.seasonHead, { borderBottomColor: t.border }]}>
        <Pressable
          style={styles.seasonToggle}
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${nome}, ${watched} de ${total} assistidos. ${open ? 'Recolher' : 'Expandir'}.`}
        >
          {/* Seta em texto: o estado aberto/fechado não depende só da rotação de um ícone. */}
          <Text style={[styles.seasonChevron, { color: t.fgSubtle }]}>{open ? '▾' : '▸'}</Text>
          <View style={styles.seasonTitleBlock}>
            <Text style={[styles.seasonTitle, { color: t.fg }]}>{nome}</Text>
            {/* O progresso fica no cabeçalho para ser legível com a temporada fechada. */}
            <Text style={[styles.seasonMeta, { color: t.fgSubtle }]}>
              {watched}/{total}
              {unseen > 0 ? '' : porVir > 0 ? ` · mais ${porVir} a caminho` : ' · completa'}
            </Text>
          </View>
        </Pressable>

        {unseen > 0 ? (
          <Pressable
            onPress={() => markSeason.mutate(season.seasonNumber)}
            disabled={markSeason.isPending}
            style={[styles.seasonAction, { borderColor: t.borderStrong }]}
            accessibilityRole="button"
            accessibilityLabel={`Marcar os ${unseen} episódios não vistos de ${nome}`}
          >
            <Text style={[styles.seasonActionText, { color: t.fg }]}>Marcar {unseen}</Text>
          </Pressable>
        ) : null}
      </View>

      {open
        ? season.episodes.map((episode) => (
            <SeasonEpisode
              key={episode.id}
              episode={episode}
              count={countOf(episode)}
              peak={peak}
              onMarkUpTo={() => onMarkUpTo(episode)}
            />
          ))
        : null}
    </View>
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
  statusBlock: { paddingHorizontal: Spacing[4], paddingTop: Spacing[4], gap: Spacing[2] },
  statusTitle: EyebrowStyle,
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  statusChip: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  statusChipText: { fontSize: FontSize.sm },

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
  seasonToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing[2], minHeight: TouchTarget },
  seasonChevron: { fontSize: FontSize.base, width: 14 },
  seasonTitleBlock: { flex: 1 },
  seasonTitle: { fontSize: FontSize.base, fontWeight: '700' },
  seasonMeta: { fontSize: FontSize.xs, fontVariant: ['tabular-nums'] },
  seasonAction: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  seasonActionText: { fontSize: FontSize.sm, fontWeight: '600' },
});
