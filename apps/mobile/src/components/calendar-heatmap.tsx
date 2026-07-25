import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatRuntime } from '@reprise/shared';
import type { CalendarDayDto } from '@reprise/shared';
import { EyebrowStyle, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CELL = 11;
const GAP = 2;
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Calendário de atividade do ano — o mesmo do web, adaptado à tela estreita.
 *
 * <b>Rampa sequencial de uma cor só</b>, com os cortes por quartil sobre os dias ATIVOS. Escala
 * absoluta achataria o ano inteiro num tom só: quem vê três episódios num sábado e trinta numa
 * maratona precisa que os dois apareçam.
 *
 * <b>Sem tooltip.</b> No celular ela prenderia o valor atrás de um toque; o resumo abaixo diz em
 * texto o que a grade mostra em cor, que é o mesmo papel da tabela equivalente no web.
 */
export function CalendarHeatmap({ year, days }: { year: number; days: readonly CalendarDayDto[] }) {
  const t = useTheme();

  const { weeks, cuts, active, total } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));

    // Quartis sobre os dias com atividade — incluir os vazios jogaria todos os cortes para zero.
    const counts = days.map((d) => d.exhibitions).sort((a, b) => a - b);
    const at = (q: number) => counts[Math.floor(counts.length * q)] ?? 1;
    const cuts = counts.length > 0 ? [at(0.25), at(0.5), at(0.75)] : [1, 2, 3];

    const first = new Date(year, 0, 1);
    const last = new Date(year, 11, 31);
    // A grade começa no domingo anterior a 1º de janeiro, para as colunas serem semanas inteiras.
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());

    const weeks: (CalendarDayDto | null)[][] = [];
    let week: (CalendarDayDto | null)[] = [];

    for (let d = new Date(start); d <= last || week.length > 0; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      week.push(d.getFullYear() === year ? (byDate.get(iso) ?? null) : null);

      if (week.length === 7) {
        weeks.push(week);
        week = [];
        if (d >= last) break;
      }
    }

    return {
      weeks,
      cuts,
      active: days.length,
      total: days.reduce((sum, d) => sum + d.seconds, 0),
    };
  }, [year, days]);

  const colorFor = (day: CalendarDayDto | null): string => {
    if (!day || day.exhibitions === 0) return t.trackEmpty;
    const [q1, q2, q3] = cuts as [number, number, number];
    if (day.exhibitions <= q1) return t.track[0]!;
    if (day.exhibitions <= q2) return t.track[1]!;
    if (day.exhibitions <= q3) return t.track[2]!;
    return t.track[3]!;
  };

  return (
    <View style={styles.block}>
      <Text style={[styles.title, { color: t.fgSubtle }]}>Calendário de {year}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.grid}>
          <View style={styles.weekdays}>
            {WEEKDAYS.map((d, i) => (
              // Só ímpares rotulados: sete rótulos de 11px viram borrão.
              <Text key={i} style={[styles.weekday, { color: t.fgSubtle }]}>
                {i % 2 === 1 ? d : ''}
              </Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.week}>
              {week.map((day, di) => (
                <View
                  key={di}
                  style={[styles.cell, { backgroundColor: colorFor(day) }]}
                  accessibilityLabel={
                    day ? `${day.date}: ${day.exhibitions} exibições` : undefined
                  }
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* O texto carrega o dado; a grade é a forma. */}
      <Text style={[styles.summary, { color: t.fgSubtle }]}>
        {active} {active === 1 ? 'dia com atividade' : 'dias com atividade'} · {formatRuntime(total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing[2] },
  title: EyebrowStyle,
  grid: { flexDirection: 'row', gap: GAP },
  weekdays: { gap: GAP, marginRight: Spacing[1] },
  weekday: { fontSize: 8, height: CELL, lineHeight: CELL, width: 8 },
  week: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: Radius.sm },
  summary: { fontSize: FontSize.xs },
});
