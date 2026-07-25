import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface Bar {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly detail: string;
}

/**
 * Barras horizontais, uma série só e um acento só.
 *
 * Horizontal, e não vertical como no web: numa tela de celular o rótulo de uma barra vertical
 * teria de ficar deitado ou abreviado, e nome de série não sobrevive a isso.
 *
 * Colorir a barra pelo tamanho duplicaria o comprimento num canal que não acrescenta nada, então
 * a cor é fixa. Não há tooltip — num celular ela exigiria toque e prenderia o valor atrás de uma
 * interação —, e por isso **todo** valor aparece escrito ao lado da barra.
 */
export function BarChart({
  title,
  bars,
  format,
  emptyMessage = 'Nada no período.',
}: {
  title: string;
  bars: readonly Bar[];
  format: (value: number) => string;
  emptyMessage?: string;
}) {
  const t = useTheme();
  const max = bars.reduce((m, b) => Math.max(m, b.value), 0);

  return (
    <View style={styles.chart} accessibilityLabel={title}>
      <Text style={[styles.title, { color: t.fg }]}>{title}</Text>

      {bars.length === 0 ? (
        <Text style={[styles.empty, { color: t.fgSubtle }]}>{emptyMessage}</Text>
      ) : (
        bars.map((bar) => (
          <View key={bar.key} style={styles.row} accessibilityLabel={bar.detail}>
            <Text style={[styles.label, { color: t.fgMuted }]} numberOfLines={1}>
              {bar.label}
            </Text>
            <View style={[styles.track, { backgroundColor: t.trackEmpty }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: t.track[1], width: max > 0 ? `${(bar.value / max) * 100}%` : 0 },
                ]}
              />
            </View>
            <Text style={[styles.value, { color: t.fg }]} numberOfLines={1}>
              {format(bar.value)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { gap: Spacing[2] },
  title: { fontSize: FontSize.base, fontWeight: '700', marginBottom: Spacing[1] },
  empty: { fontSize: FontSize.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], minHeight: 28 },
  label: { fontSize: FontSize.xs, width: 78 },
  track: { flex: 1, height: 10, borderRadius: Radius.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.sm },
  value: { fontSize: FontSize.xs, fontVariant: ['tabular-nums'], width: 74, textAlign: 'right' },
});
