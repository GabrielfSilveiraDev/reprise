import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Airing,
  formatEpisodeCode,
  formatRuntime,
  formatWatchCount,
  formatWatchedAt,
} from '@reprise/shared';
import type { Episode } from '@reprise/shared';
import { EpisodeThumb, THUMB_HEIGHT, THUMB_WIDTH } from '@/components/episode-thumb';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Quantos níveis a rampa de rewatch tem. Igual ao `WatchTrack.MAX_LEVEL` do web. */
const MAX_LEVEL = 4;

/**
 * Uma linha de episódio.
 *
 * <b>Marcar é um toque.</b> Antes eram dois — tocar a linha para abrir as ações e tocar
 * "Assisti" —, com um atalho de toque longo que ninguém descobre porque nada na tela o anuncia.
 * A ação mais frequente do app não pode custar mais que a menos frequente, então ela ganhou
 * botão próprio, visível, de 48px. Tocar a linha continua abrindo o resto (rewatch, desmarcar,
 * marcar até aqui), que é o uso raro.
 *
 * <b>A intensidade do rewatch usa dois canais.</b> A rampa de cor tem passos de ΔE≈8 entre
 * níveis vizinhos — o suficiente para "visto ou não", pouco para comparar 1× com 4× de relance.
 * Por isso a barra sob a capa varia de altura junto com o tom, e a contagem aparece escrita no
 * botão. Cor sozinha nunca carrega o número.
 */
export function EpisodeRow({
  episode,
  count,
  peak,
  onMark,
  onUnmark,
  onMarkUpTo,
}: {
  episode: Episode;
  count: number;
  peak: number;
  onMark: () => void;
  onUnmark: () => void;
  onMarkUpTo: () => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  const watched = count > 0;
  // Escala relativa ao pico DESTA série: numa série vista 17 vezes, uma exibição é pouco.
  const level = watched ? Math.max(1, Math.ceil((count / Math.max(1, peak)) * MAX_LEVEL)) : 0;
  const color = watched ? (t.track[level - 1] ?? t.accent) : t.trackEmpty;
  const code = formatEpisodeCode(episode.seasonNumber, episode.episodeNumber);
  const aired = Airing.hasAired(episode.airDate);

  return (
    <View style={[styles.wrapper, { borderBottomColor: t.border }]}>
      <View style={styles.row}>
        <Pressable
          style={styles.main}
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${code}${episode.name ? `, ${episode.name}` : ''}. ${formatWatchCount(count)}. Toque para mais ações.`}
        >
          <View style={styles.thumb}>
            <EpisodeThumb
              seasonNumber={episode.seasonNumber}
              episodeNumber={episode.episodeNumber}
              stillPath={episode.stillPath}
              watched={watched}
            />

            {/* Segundo canal da intensidade: altura junto com o tom. */}
            <View style={[styles.levelTrack, { backgroundColor: t.trackEmpty }]}>
              <View
                style={{
                  height: watched ? `${(level / MAX_LEVEL) * 100}%` : 0,
                  backgroundColor: color,
                }}
              />
            </View>

            {!watched ? (
              <View style={[styles.unseenRing, { borderColor: t.borderStrong }]} pointerEvents="none" />
            ) : null}
          </View>

          <View style={styles.text}>
            <Text style={[styles.name, { color: t.fg }]} numberOfLines={2}>
              <Text style={styles.code}>{code}</Text>
              {episode.name ? `  ${episode.name}` : ''}
            </Text>
            <Text style={[styles.meta, { color: t.fgSubtle }]} numberOfLines={1}>
              {formatRuntime(episode.runtimeSeconds)}
              {episode.lastWatchedAt
                ? ` · ${formatWatchedAt(episode.lastWatchedAt)}`
                : !aired
                  ? ` · ${Airing.label(episode.airDate)}`
                  : ''}
            </Text>
          </View>
        </Pressable>

        {/*
          A ação principal, num alvo próprio: um toque marca. Some quando o episódio ainda não foi
          ao ar — um botão que só sabe recusar não devia ocupar 48px na linha, e um relógio no
          lugar dele diz por que ele não está lá.
        */}
        {aired ? (
          <Pressable
            onPress={onMark}
            style={[
              styles.markButton,
              watched
                ? { backgroundColor: color, borderColor: color }
                : { backgroundColor: 'transparent', borderColor: t.borderStrong, borderStyle: 'dashed' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              watched
                ? `Marcar ${code} de novo. ${formatWatchCount(count)}`
                : `Marcar ${code} como visto`
            }
          >
            <Text
              style={[
                styles.markText,
                { color: watched ? (level >= 3 ? t.accentFg : t.fg) : t.fgMuted },
              ]}
            >
              {watched ? `${count}×` : '+'}
            </Text>
          </Pressable>
        ) : (
          <View
            style={styles.markButton}
            accessible
            accessibilityLabel={`${code} ainda não foi ao ar. ${Airing.label(episode.airDate) ?? ''}`}
          >
            <Text style={[styles.markText, { color: t.fgSubtle }]}>⏳</Text>
          </View>
        )}
      </View>

      {open ? (
        <View style={[styles.actions, { backgroundColor: t.bgSunken }]}>
          {watched ? <Action label="Desmarcar" onPress={onUnmark} /> : null}
          {/* "Marcar até aqui" também sai no episódio não exibido: a linha inteira não oferece
              marcação nenhuma, senão o "aqui" da frase seria um ponto que ainda não existe. */}
          {!episode.isSpecial && aired ? (
            <Action label="Marcar até aqui" onPress={onMarkUpTo} />
          ) : null}
          {/* Um verbo só para as duas direções do tempo dizia "Estreou em amanhã". */}
          {Airing.label(episode.airDate) ? (
            <Text style={[styles.airDate, { color: t.fgSubtle }]}>
              {Airing.label(episode.airDate)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, { borderColor: t.borderStrong }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.actionText, { color: t.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing[4] },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingLeft: Spacing[4],
    paddingVertical: Spacing[2],
    minHeight: TouchTarget,
  },

  thumb: { position: 'relative', width: THUMB_WIDTH },
  unseenRing: {
    position: 'absolute',
    inset: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.sm,
  },
  levelTrack: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 4,
    height: THUMB_HEIGHT,
    borderBottomLeftRadius: Radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },

  text: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.sm },
  code: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  meta: { fontSize: FontSize.xs },

  markButton: {
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: TouchTarget / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontSize: FontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
  },
  action: {
    minHeight: TouchTarget,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: FontSize.sm, fontWeight: '700' },
  airDate: { fontSize: FontSize.xs },
});
