import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SeriesCompletion, formatPercent, formatWhen, posterUrl } from '@reprise/shared';
import type { SeriesListItem } from '@reprise/shared';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Theme } from '@/constants/theme';

/**
 * A cor de cada estado de conclusão — a mesma tabela que o web resolve por `data-state`.
 *
 * Uma função e não um `if` espalhado por componente: a barra e o selo precisam concordar, e foi
 * exatamente por decidirem separado que "Em dia" e "Finalizada" acabaram com tratamentos visuais
 * de peso diferente em vez de cores diferentes.
 */
function stateColor(completion: SeriesCompletion, theme: Theme): string {
  switch (completion.state) {
    case 'finished':
      return theme.state.finished;
    case 'up-to-date':
      return theme.state.upToDate;
    case 'behind':
      return theme.state.progress;
    case 'not-started':
      // Colorir uma barra de 0% seria pintar ausência de dado.
      return theme.borderStrong;
  }
}

/**
 * Barra de progresso.
 *
 * Sempre acompanhada do número: comprimento sozinho não distingue 88% de 92%, e no pôster ela
 * fica com 3px de altura — pequena demais para carregar informação sozinha. A cor diz em QUE
 * estado a série está; o comprimento diz o quanto falta.
 */
export function ProgressBar({
  completion,
  theme,
  height = 3,
}: {
  completion: SeriesCompletion;
  theme: Theme;
  height?: number;
}) {
  const pct = Math.round(completion.ratio * 100);
  return (
    <View
      style={[styles.track, { backgroundColor: theme.trackEmpty, height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: height / 2,
          backgroundColor: stateColor(completion, theme),
        }}
      />
    </View>
  );
}

/**
 * Selo de estado.
 *
 * A cor distingue, o TEXTO informa: "Finalizada" e "Em dia" têm de continuar legíveis em preto e
 * branco, e para quem não separa as duas cores o rótulo é a informação inteira.
 */
export function CompletionBadge({ completion }: { completion: SeriesCompletion }) {
  const t = useTheme();
  const badge = completion.badge;
  if (!badge) return null;

  return (
    <View style={[styles.badge, { backgroundColor: stateColor(completion, t) }]}>
      <Text style={[styles.badgeText, { color: t.state.fg }]}>{badge}</Text>
    </View>
  );
}

function completionOf(item: SeriesListItem): SeriesCompletion {
  return SeriesCompletion.of({
    productionStatus: item.productionStatus,
    episodesTotal: item.episodesTotal,
    episodesAired: item.episodesAired,
    episodesWatched: item.episodesWatched,
  });
}

/** Rótulo único para leitor de tela, para a linha e o pôster falarem a mesma coisa. */
function accessibilityLabelFor(item: SeriesListItem, completion: SeriesCompletion): string {
  return `${item.name}. ${item.episodesWatched} de ${item.episodesTotal} episódios, ${formatPercent(
    completion.ratio,
  )}. ${completion.label}.`;
}

/** Cartão da grade: pôster grande, barra de progresso colada embaixo dele e o selo por cima. */
export function SeriesPoster({ item, width }: { item: SeriesListItem; width: number }) {
  const t = useTheme();
  const completion = completionOf(item);
  const poster = posterUrl(item.posterPath, 'w342');

  return (
    <Pressable
      style={[styles.posterCard, { width }]}
      onPress={() => router.push(`/series/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabelFor(item, completion)}
    >
      <View style={styles.posterFrame}>
        {poster ? (
          <Image
            source={poster}
            style={[styles.posterImage, { backgroundColor: t.bgSunken }]}
            contentFit="cover"
            transition={140}
          />
        ) : (
          <View style={[styles.posterImage, styles.posterEmpty, { backgroundColor: t.bgSunken }]}>
            <Text style={[styles.posterEmptyText, { color: t.fgSubtle }]} numberOfLines={3}>
              {item.name}
            </Text>
          </View>
        )}

        {completion.badge ? (
          <View style={styles.badgeAnchor}>
            <CompletionBadge completion={completion} />
          </View>
        ) : null}
      </View>

      {/* Foi o que você pediu: dá para ver quanto falta sem abrir a série. */}
      <ProgressBar completion={completion} theme={t} />

      <Text style={[styles.posterName, { color: t.fg }]} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={[styles.posterMeta, { color: t.fgSubtle }]} numberOfLines={1}>
        {item.episodesWatched}/{item.episodesTotal} · {formatPercent(completion.ratio)}
      </Text>
    </Pressable>
  );
}

/** Linha da lista: densa, para varrer o acervo procurando um nome. */
export function SeriesRow({ item }: { item: SeriesListItem }) {
  const t = useTheme();
  const completion = completionOf(item);
  const poster = posterUrl(item.posterPath, 'w154');

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/series/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabelFor(item, completion)}
    >
      {poster ? (
        <Image source={poster} style={styles.rowPoster} contentFit="cover" transition={120} />
      ) : (
        <View style={[styles.rowPoster, { backgroundColor: t.bgSunken }]} />
      )}

      <View style={styles.rowText}>
        <View style={styles.rowHead}>
          <Text style={[styles.rowName, { color: t.fg }]} numberOfLines={2}>
            {item.name}
          </Text>
          <CompletionBadge completion={completion} />
        </View>

        <Text style={[styles.rowMeta, { color: t.fgMuted }]} numberOfLines={1}>
          {completion.label}
        </Text>
        {/* "nunca" sozinho numa linha não diz nunca o quê. */}
        <Text style={[styles.rowMeta, { color: t.fgSubtle }]} numberOfLines={1}>
          {item.lastWatchedAt ? `visto ${formatWhen(item.lastWatchedAt)}` : 'nunca assistida'}
        </Text>

        <View style={styles.rowProgress}>
          <ProgressBar completion={completion} theme={t} height={4} />
          <Text style={[styles.percent, { color: t.fgMuted }]}>
            {formatPercent(completion.ratio)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },

  badge: { paddingHorizontal: Spacing[2], paddingVertical: 3, borderRadius: Radius.sm },
  badgeText: { fontSize: 11, fontWeight: '700' },

  posterCard: { gap: Spacing[1] },
  posterFrame: { position: 'relative' },
  posterImage: { width: '100%', aspectRatio: 2 / 3, borderRadius: Radius.md },
  posterEmpty: { alignItems: 'center', justifyContent: 'center', padding: Spacing[2] },
  posterEmptyText: { fontSize: FontSize.xs, textAlign: 'center' },
  badgeAnchor: { position: 'absolute', top: Spacing[1], left: Spacing[1] },
  posterName: { fontSize: FontSize.sm, fontWeight: '700', marginTop: 2 },
  posterMeta: { fontSize: FontSize.xs, fontVariant: ['tabular-nums'] },

  row: {
    flexDirection: 'row',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    minHeight: TouchTarget,
    alignItems: 'center',
  },
  rowPoster: { width: 44, height: 66, borderRadius: Radius.sm },
  rowText: { flex: 1, gap: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2] },
  rowName: { flex: 1, fontSize: FontSize.base, fontWeight: '700' },
  rowMeta: { fontSize: FontSize.xs },
  rowProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: Spacing[1] },
  percent: { fontSize: FontSize.xs, fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'right' },
});
