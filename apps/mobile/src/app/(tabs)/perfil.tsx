import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { Auth } from '@/api/auth';
import { formatPercent, formatRuntime, formatTotalTime, formatWatchedAt } from '@reprise/shared';
import type { Profile, StatsOverviewDto } from '@reprise/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile, useStatsOverview } from '@/api/queries';
import { BarChart } from '@/components/bar-chart';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { EyebrowStyle, FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useTheme } from '@/hooks/use-theme';

/**
 * Perfil e estatísticas.
 *
 * Juntos numa tela só porque no celular respondem à mesma curiosidade — "quanto disso é meu?".
 * Vêm de dois endpoints diferentes e de duas chaves de cache diferentes, para que a contagem de
 * séries não precise esperar a agregação do histórico inteiro.
 */
export default function ProfileScreen() {
  const t = useTheme();
  const status = useAutoSync();
  const profile = useProfile();
  const qc = useQueryClient();

  /**
   * Sair avisa antes quando há coisa na fila: as ações pendentes ficam no SQLite do aparelho e
   * não sobem sem sessão. Descobrir isso depois seria descobrir tarde.
   */
  const sair = () => {
    const pendentes = status.pending;
    const seguir = async () => {
      await Auth.logout();
      qc.clear();
      router.replace('/login');
    };

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

  /**
   * As marcações em massa ficam fora por padrão — são as que o TV Time gravou todas na mesma
   * data ao importar temporadas inteiras. Com elas, dezembro/2025 engole qualquer leitura
   * temporal. São a maior parte do histórico, então a tela declara quantas está escondendo.
   */
  const [includeBackfill, setIncludeBackfill] = useState(false);
  const stats = useStatsOverview(includeBackfill);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <SyncBar status={status} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: t.fgSubtle }]}>Perfil</Text>

        <QueryState query={profile}>{(p) => <Identity profile={p} />}</QueryState>

        <View style={[styles.divider, { backgroundColor: t.border }]} />

        <View style={styles.filterRow}>
          <Text style={[styles.filterLabel, { color: t.fg }]}>Incluir marcações em massa</Text>
          <Switch
            value={includeBackfill}
            onValueChange={setIncludeBackfill}
            accessibilityLabel="Incluir marcações em massa nas estatísticas"
          />
        </View>

        <QueryState query={stats}>
          {(data) => <Stats data={data} includeBackfill={includeBackfill} />}
        </QueryState>

        <View style={[styles.divider, { backgroundColor: t.border }]} />

        <Pressable
          onPress={sair}
          style={[styles.signOut, { borderColor: t.danger }]}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Text style={[styles.signOutText, { color: t.danger }]}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Identity({ profile }: { profile: Profile }) {
  const t = useTheme();
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.identity}>
      <View style={[styles.avatar, { backgroundColor: t.accentQuiet, borderColor: t.accent }]}>
        <Text style={[styles.avatarText, { color: t.fg }]}>{initial}</Text>
      </View>

      <View style={styles.identityText}>
        <Text style={[styles.name, { color: t.fg }]}>{profile.displayName}</Text>
        <Text style={[styles.email, { color: t.fgMuted }]}>{profile.email}</Text>
        <Text style={[styles.since, { color: t.fgSubtle }]}>
          No Reprise desde {formatWatchedAt(profile.memberSince)}
          {profile.lastImportedAt
            ? ` · importado ${formatWatchedAt(profile.lastImportedAt)}`
            : ''}
        </Text>
      </View>
    </View>
  );
}

function Stats({ data, includeBackfill }: { data: StatsOverviewDto; includeBackfill: boolean }) {
  const t = useTheme();
  const s = data.summary;

  return (
    <View style={styles.stats}>
      {!includeBackfill && s.backfillExhibitions > 0 ? (
        <View style={[styles.notice, { backgroundColor: t.accentQuiet }]}>
          <Text style={[styles.noticeText, { color: t.fg }]}>
            <Text style={styles.strong}>{s.backfillExhibitions.toLocaleString('pt-BR')}</Text>{' '}
            exibições em massa estão fora destes números. Todas carregam a mesma data — incluí-las
            diria que você assistiu tudo num dia só.
          </Text>
        </View>
      ) : null}

      <View style={styles.tiles}>
        <Tile label="Tempo assistido" value={formatTotalTime(s.totalSeconds)} />
        <Tile label="Exibições" value={s.exhibitions.toLocaleString('pt-BR')} />
        <Tile label="Episódios" value={s.distinctEpisodes.toLocaleString('pt-BR')} />
        <Tile label="Séries" value={String(s.seriesCount)} />
        <Tile label="Rewatch" value={formatPercent(s.rewatchRate)} hint="das exibições" />
        <Tile
          label="Maior sequência"
          value={`${data.streaks.longestDays} d`}
          hint={data.streaks.currentDays > 0 ? `atual: ${data.streaks.currentDays} d` : 'sem sequência'}
        />
      </View>

      {s.firstWatchedAt ? (
        <Text style={[styles.period, { color: t.fgSubtle }]}>
          De {formatWatchedAt(s.firstWatchedAt)} a {formatWatchedAt(s.lastWatchedAt)}.
        </Text>
      ) : null}

      {s.exhibitions === 0 ? (
        <Text style={[styles.period, { color: t.fgMuted }]}>
          Nenhuma exibição fora das marcações em massa. Ligue o filtro acima para ver o histórico
          importado.
        </Text>
      ) : (
        <>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
          <BarChart
            title="Tempo assistido por ano"
            bars={data.byYear.map((b) => ({
              key: b.label,
              label: b.label,
              value: b.seconds,
              detail: `${b.label}: ${formatRuntime(b.seconds)} em ${b.exhibitions} exibições`,
            }))}
            format={(v) => formatTotalTime(v)}
          />

          <View style={[styles.divider, { backgroundColor: t.border }]} />
          <BarChart
            title="Séries por tempo assistido"
            bars={data.topSeries.map((x) => ({
              key: String(x.seriesId),
              label: x.name,
              value: x.seconds,
              detail: `${x.name}: ${formatRuntime(x.seconds)} · ${x.exhibitions} exibições em ${x.distinctEpisodes} episódios`,
            }))}
            format={(v) => formatTotalTime(v)}
          />

          {data.topSeries.length > 0 ? (
            <Pressable
              onPress={() => router.push(`/series/${data.topSeries[0]!.seriesId}`)}
              style={[styles.link, { borderColor: t.borderStrong }]}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${data.topSeries[0]!.name}, a série que você mais assistiu`}
            >
              <Text style={[styles.linkText, { color: t.fg }]}>
                Abrir {data.topSeries[0]!.name}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.bgRaised, borderColor: t.border }]}>
      <Text style={[styles.tileLabel, { color: t.fgSubtle }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: t.fg }]}>{value}</Text>
      {hint ? <Text style={[styles.tileHint, { color: t.fgSubtle }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[4] },
  eyebrow: EyebrowStyle,
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing[2] },

  identity: { flexDirection: 'row', gap: Spacing[3], alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.xl, fontWeight: '700' },
  identityText: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.lg, fontWeight: '700' },
  email: { fontSize: FontSize.sm },
  since: { fontSize: FontSize.xs },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TouchTarget,
    gap: Spacing[3],
  },
  filterLabel: { fontSize: FontSize.sm, flex: 1 },

  stats: { gap: Spacing[4] },
  notice: { padding: Spacing[3], borderRadius: Radius.md },
  noticeText: { fontSize: FontSize.sm, lineHeight: 20 },
  strong: { fontWeight: '700' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    padding: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  tileLabel: { fontSize: 10, letterSpacing: 0.8, fontWeight: '700', textTransform: 'uppercase' },
  tileValue: { fontSize: FontSize.lg, fontWeight: '700', marginTop: 2 },
  tileHint: { fontSize: 10 },

  period: { fontSize: FontSize.xs },
  link: {
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { fontSize: FontSize.sm, fontWeight: '700' },
  signOut: {
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: FontSize.sm, fontWeight: '700' },
});
