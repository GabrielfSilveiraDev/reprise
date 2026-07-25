import { StyleSheet, Text, View } from 'react-native';
import { SessionSummary, formatTotalTime, formatWatchedAt } from '@reprise/shared';
import type { RewatchSession } from '@reprise/shared';
import { EyebrowStyle, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Quantas vezes você percorreu esta série, e quando.
 *
 * A mesma informação e as mesmas frases do web — vêm do `SessionSummary`, compartilhado. O que
 * muda é a forma: aqui cada passada empilha em duas linhas em vez de virar coluna, porque
 * quatro colunas não cabem em 360px.
 */
export function RewatchSessions({
  sessions,
  backfillExhibitions,
}: {
  sessions: readonly RewatchSession[];
  backfillExhibitions: number;
}) {
  const t = useTheme();
  const notice = SessionSummary.hiddenNotice(backfillExhibitions);

  if (sessions.length === 0 && !notice) return null;

  return (
    <View style={[styles.block, { backgroundColor: t.bgSunken }]}>
      <Text style={[styles.title, { color: t.fgSubtle }]}>Suas passadas</Text>

      {sessions.length > 0 ? (
        sessions.map((s) => (
          <View key={s.ordinal} style={[styles.session, { borderBottomColor: t.border }]}>
            <View style={styles.sessionTop}>
              <Text style={[styles.ordinal, { color: t.fg }]}>
                {SessionSummary.ordinalLabel(s.ordinal)}
              </Text>
              <Text style={[styles.time, { color: t.fgMuted }]}>
                {formatTotalTime(s.totalSeconds)}
              </Text>
            </View>
            <Text style={[styles.when, { color: t.fgMuted }]}>
              {formatWatchedAt(s.startedAt)}
              {s.spanDays > 1 ? ` – ${formatWatchedAt(s.endedAt)}` : ''}
            </Text>
            <Text style={[styles.detail, { color: t.fgSubtle }]}>{SessionSummary.detail(s)}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.notice, { color: t.fgSubtle }]}>
          Nenhuma passada com data confiável ainda. As marcações que você fizer daqui em diante
          aparecem aqui.
        </Text>
      )}

      {notice ? <Text style={[styles.notice, { color: t.fgSubtle }]}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginHorizontal: Spacing[4],
    marginTop: Spacing[5],
    padding: Spacing[3],
    borderRadius: Radius.lg,
    gap: Spacing[2],
  },
  title: EyebrowStyle,
  session: {
    paddingBottom: Spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 1,
  },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  ordinal: { fontSize: FontSize.sm, fontWeight: '700' },
  time: { fontSize: FontSize.xs, fontVariant: ['tabular-nums'] },
  when: { fontSize: FontSize.xs },
  detail: { fontSize: FontSize.xs },
  notice: { fontSize: FontSize.xs, lineHeight: 17 },
});
