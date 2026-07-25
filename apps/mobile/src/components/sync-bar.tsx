import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontSize, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SyncStatus } from '@/hooks/use-auto-sync';

/**
 * A barra que diz se o que está na tela já chegou ao servidor.
 *
 * Num app offline isso não é enfeite: sem ela, "marquei" e "o servidor sabe que marquei" viram
 * a mesma coisa aos olhos de quem usa, e a diferença aparece só quando algo se perde. O estado
 * nunca é comunicado só por cor — cada situação tem texto próprio.
 */
export function SyncBar({ status }: { status: SyncStatus }) {
  const t = useTheme();

  if (status.online && status.pending === 0 && !status.syncing) return null;

  const message = status.syncing
    ? 'Sincronizando…'
    : status.pending > 0
      ? `${status.pending} ${status.pending === 1 ? 'marcação pendente' : 'marcações pendentes'}`
      : 'Sem conexão — o que você marcar fica guardado';

  return (
    <View
      style={[styles.bar, { backgroundColor: t.accentQuiet, borderBottomColor: t.border }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, { color: t.fg }]}>{message}</Text>

      {status.pending > 0 && status.online && !status.syncing ? (
        <Pressable
          onPress={status.flushNow}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Sincronizar agora"
        >
          <Text style={[styles.actionText, { color: t.accent }]}>Sincronizar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: TouchTarget,
  },
  text: { fontSize: FontSize.sm, flexShrink: 1 },
  action: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingLeft: Spacing[3],
  },
  actionText: { fontSize: FontSize.sm, fontWeight: '700' },
});
