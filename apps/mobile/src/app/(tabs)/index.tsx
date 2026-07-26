import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { HomeShelf, formatEpisodeCode, formatWatchedAt, posterUrl } from '@reprise/shared';
import type { NextUpItem } from '@reprise/shared';
import { useMarkEpisode, useNextUp, usePremieres, useProfile } from '@/api/queries';
import { Logo } from '@/components/logo';
import { PremiereStrip } from '@/components/premiere-strip';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { EyebrowStyle, FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useTheme } from '@/hooks/use-theme';

/**
 * A tela que abre o app: o que assistir agora.
 *
 * É a razão de o app existir no celular — no sofá ninguém quer navegar um acervo de 115 séries
 * para descobrir onde parou. Cada linha traz o botão de marcar direto, sem entrar no detalhe.
 *
 * <b>Duas prateleiras, não uma lista.</b> Antes eram 49 linhas iguais ordenadas por atividade, só
 * que 47 tinham a MESMA atividade — a data da importação. A tela listava tudo e não respondia
 * nada. O agrupamento vem do {@link HomeShelf}, o mesmo que o web usa, para que as prateleiras
 * tenham os mesmos nomes e o mesmo corte nos dois clientes.
 *
 * `SectionList` e não `FlatList`: os cabeçalhos de prateleira grudam no topo enquanto se rola, o
 * que mantém visível de qual grupo é a linha que está na mão.
 */
export default function NextUpScreen() {
  const t = useTheme();
  const status = useAutoSync();
  const query = useNextUp();
  // Falham em silêncio de propósito: sem estreias a faixa some, sem perfil o cumprimento fica sem
  // vocativo. Nenhum dos dois é motivo para a tela principal mostrar erro.
  const premieres = usePremieres();
  const profile = useProfile();

  const [guardadasAbertas, setGuardadasAbertas] = useState(false);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {(items) => {
          const { emAndamento, guardadas } = HomeShelf.split(items);
          const proximas = HomeShelf.upcomingPremieres(premieres.data ?? []);
          const nome = profile.data?.displayName?.trim().split(/\s+/)[0];

          const sections = [
            { key: 'andamento', title: 'Continuar assistindo', data: emAndamento },
            // Seção sem linhas: o cabeçalho É a faixa de estreias. Assim ela fica entre as duas
            // prateleiras, na mesma ordem do web, sem sair da virtualização da lista.
            { key: 'estreias', title: null, data: [] as NextUpItem[] },
            {
              key: 'guardadas',
              title: 'Guardadas',
              data: guardadasAbertas ? guardadas : ([] as NextUpItem[]),
            },
          ].filter((s) => s.key !== 'andamento' || emAndamento.length > 0);

          return (
            <SectionList
              sections={sections}
              keyExtractor={(item) => String(item.seriesId)}
              contentContainerStyle={styles.list}
              refreshing={query.isFetching}
              onRefresh={() => query.refetch()}
              stickySectionHeadersEnabled={false}
              ListHeaderComponent={
                <View style={styles.head}>
                  <View style={styles.brandRow}>
                    <Logo size={18} />
                    <Text style={[styles.eyebrow, { color: t.fgSubtle }]}>Reprise</Text>
                  </View>
                  <Text style={[styles.greeting, { color: t.fg }]}>
                    {HomeShelf.greeting()}
                    {nome ? `, ${nome}` : ''}.
                  </Text>
                  <Text style={[styles.summary, { color: t.fgMuted }]}>
                    {HomeShelf.summary(emAndamento.length, guardadas.length)}
                  </Text>
                </View>
              }
              renderSectionHeader={({ section }) => {
                if (section.key === 'estreias') return <PremiereStrip premieres={proximas} />;
                if (section.key === 'guardadas') {
                  return (
                    <GuardadasHeader
                      total={guardadas.length}
                      aberto={guardadasAbertas}
                      onToggle={() => setGuardadasAbertas((v) => !v)}
                    />
                  );
                }
                return <Text style={[styles.shelfHead, { color: t.fg }]}>{section.title}</Text>;
              }}
              renderItem={({ item, section }) => (
                <NextUpRow item={item} quieta={section.key === 'guardadas'} />
              )}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: t.border }]} />
              )}
            />
          );
        }}
      </QueryState>
    </SafeAreaView>
  );
}

/**
 * O cabeçalho que abre e fecha o acervo guardado.
 *
 * Fechado por padrão: são 48 séries paradas desde a importação, e abertas empurram para fora da
 * tela justamente o que dá para assistir hoje. `accessibilityState.expanded` para o leitor de tela
 * anunciar o estado — sem isso, é um botão que muda a tela sem avisar o que fez.
 */
function GuardadasHeader({
  total,
  aberto,
  onToggle,
}: {
  total: number;
  aberto: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  if (total === 0) return null;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={[styles.guardadasRow, { borderTopColor: t.border }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={`Guardadas, ${total} séries. ${aberto ? 'Tocar para recolher' : 'Tocar para ver'}.`}
      >
        <Text style={[styles.shelfHead, { color: t.fg }]}>Guardadas</Text>
        <Text style={[styles.guardadasCount, { color: t.fgSubtle }]}>
          {total} séries {aberto ? '▾' : '▸'}
        </Text>
      </Pressable>

      {aberto ? (
        <Text style={[styles.guardadasNote, { color: t.fgSubtle }]}>
          Paradas há mais de dois meses, quase todas desde a importação do TV Time. Ficam aqui sem
          pressa — retome quando quiser.
        </Text>
      ) : null}
    </View>
  );
}

function NextUpRow({ item, quieta = false }: { item: NextUpItem; quieta?: boolean }) {
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
          {/* Nas guardadas a data é a mesma para quase todas; repeti-la 48 vezes é ruído, e a
              própria seção já diz de quando são. */}
          {quieta ? null : (
            <Text style={[styles.meta, { color: t.fgSubtle }]}>
              {formatWatchedAt(item.lastActivityAt)}
            </Text>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={() => mark.mutate(item.episode.id)}
        disabled={mark.isPending}
        style={[
          styles.markButton,
          quieta
            ? { borderColor: t.borderStrong, borderWidth: 1 }
            : { backgroundColor: t.accent },
          { opacity: mark.isPending ? 0.6 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Marcar ${code} de ${item.seriesName} como assistido`}
      >
        <Text style={[styles.markLabel, { color: quieta ? t.fg : t.accentFg }]}>Assisti</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: Spacing[8] },

  head: { paddingHorizontal: Spacing[4], paddingTop: Spacing[5], paddingBottom: Spacing[4] },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  eyebrow: EyebrowStyle,
  greeting: { fontSize: FontSize.xl, fontWeight: '700', marginTop: Spacing[2] },
  summary: { fontSize: FontSize.sm, marginTop: Spacing[1], lineHeight: 20 },

  shelfHead: { fontSize: FontSize.lg, fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing[4] },

  guardadasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    marginTop: Spacing[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing[4],
    minHeight: TouchTarget,
  },
  guardadasCount: { fontSize: FontSize.sm },
  guardadasNote: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
    fontSize: FontSize.xs,
    lineHeight: 18,
  },

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
