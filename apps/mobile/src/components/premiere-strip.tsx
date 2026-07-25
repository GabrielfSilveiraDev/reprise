import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatEpisodeCode, formatWatchedAt } from '@reprise/shared';
import type { Premiere } from '@reprise/shared';
import { EpisodeThumb } from '@/components/episode-thumb';
import { EyebrowStyle, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * O que ainda vai estrear, em faixa horizontal no topo de "Próximos".
 *
 * <b>Não virou aba.</b> Já são quatro, e quatro rótulos de texto disputam a largura num telefone
 * pequeno — foi um dos pontos da auditoria de desenho. E o lugar é este por semântica, não por
 * falta de espaço: "Próximos" responde "o que assisto agora"; estreias respondem a mesma
 * pergunta no futuro. São o mesmo assunto em tempos verbais diferentes.
 *
 * Horizontal e compacta porque é contexto, não tarefa: nada aqui se marca como assistido — o
 * episódio ainda nem foi ao ar.
 */
export function PremiereStrip({ premieres }: { premieres: readonly Premiere[] }) {
  const t = useTheme();
  if (premieres.length === 0) return null;

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.fgSubtle }]}>Estreias</Text>
        <Text style={[styles.count, { color: t.fgSubtle }]}>
          {premieres.length} {premieres.length === 1 ? 'episódio' : 'episódios'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {premieres.map((p) => (
          <Pressable
            key={p.episodeId}
            style={[styles.card, { backgroundColor: t.bgRaised, borderColor: t.border }]}
            onPress={() => router.push(`/series/${p.seriesId}`)}
            accessibilityRole="button"
            accessibilityLabel={`${p.seriesName}, ${formatEpisodeCode(p.seasonNumber, p.episodeNumber)}, estreia ${quando(p.airDate)}${p.isSeasonPremiere ? '. Estreia de temporada.' : ''}`}
          >
            <EpisodeThumb
              seasonNumber={p.seasonNumber}
              episodeNumber={p.episodeNumber}
              stillPath={p.stillPath}
              watched={false}
            />

            <View style={styles.text}>
              <Text style={[styles.when, { color: t.accent }]} numberOfLines={1}>
                {quando(p.airDate)}
              </Text>
              <Text style={[styles.series, { color: t.fg }]} numberOfLines={2}>
                {p.seriesName}
              </Text>
              <Text style={[styles.episode, { color: t.fgSubtle }]} numberOfLines={1}>
                {formatEpisodeCode(p.seasonNumber, p.episodeNumber)}
                {/* Estreia de temporada é a notícia; o sétimo episódio não é. */}
                {p.isSeasonPremiere ? ' · nova temporada' : ''}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** A data vem como `YYYY-MM-DD`; o meio-dia evita o dia virar por fuso. */
function quando(airDate: string): string {
  return formatWatchedAt(`${airDate}T12:00:00Z`);
}

const styles = StyleSheet.create({
  block: { gap: Spacing[2], paddingTop: Spacing[2] },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
  },
  title: EyebrowStyle,
  count: { fontSize: FontSize.xs },
  strip: { gap: Spacing[3], paddingHorizontal: Spacing[4], paddingBottom: Spacing[2] },
  card: {
    width: 160,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing[2],
    gap: Spacing[2],
  },
  text: { gap: 1 },
  when: { fontSize: FontSize.xs, fontWeight: '700' },
  series: { fontSize: FontSize.sm, fontWeight: '700' },
  episode: { fontSize: FontSize.xs },
});
