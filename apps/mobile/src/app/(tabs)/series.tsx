import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeriesCompletion } from '@reprise/shared';
import type { SeriesListItem } from '@reprise/shared';
import { useSeriesList } from '@/api/queries';
import { QueryState } from '@/components/query-state';
import { SeriesPoster, SeriesRow } from '@/components/series-card';
import { SyncBar } from '@/components/sync-bar';
import CinemaSeries from '@/design/cinema/Series';
import EditorialSeries from '@/design/editorial/Series';
import PainelSeries from '@/design/painel/Series';
import { useDesign } from '@/design/registry';
import { LocalStore } from '@/offline/local-store';
import { EyebrowStyle, FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useTheme } from '@/hooks/use-theme';

/**
 * A rota é uma casca: quem desenha é o design escolhido em Ajustes.
 *
 * O desenho clássico continua morando neste arquivo, logo abaixo. Os outros três vivem em
 * `@/design/<id>/`, e um design desconhecido cai aqui — é o que garante que o app abra mesmo com a
 * preferência corrompida.
 */
export default function SeriesRoute() {
  const { design } = useDesign();
  if (design === 'cinema') return <CinemaSeries />;
  if (design === 'editorial') return <EditorialSeries />;
  if (design === 'painel') return <PainelSeries />;
  return <ClassicoSeries />;
}

type Layout = 'poster' | 'list';
type Filter = 'all' | 'unfinished' | 'finished';

const LAYOUT_SETTING = 'seriesLayout';

/**
 * O acervo, em duas leituras.
 *
 * **Grade de pôsteres** para reconhecer pela capa — é assim que se procura algo para assistir.
 * **Lista** para varrer 115 nomes procurando um específico, com mais texto por linha. Nenhuma das
 * duas é "a certa": elas servem a perguntas diferentes, e por isso a escolha fica guardada — ter
 * de reajustar a cada abertura seria pior do que só ter uma.
 */
function ClassicoSeries() {
  const t = useTheme();
  const status = useAutoSync();
  const query = useSeriesList();

  const [layout, setLayout] = useState<Layout>('poster');
  const [filter, setFilter] = useState<Filter>('all');
  const [term, setTerm] = useState('');

  useEffect(() => {
    LocalStore.open().then(async (store) => {
      const saved = await store.getSetting(LAYOUT_SETTING);
      if (saved === 'poster' || saved === 'list') setLayout(saved);
    });
  }, []);

  const chooseLayout = (next: Layout) => {
    setLayout(next);
    LocalStore.open().then((store) => store.setSetting(LAYOUT_SETTING, next));
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <SyncBar status={status} />
      <QueryState query={query}>
        {(all) => (
          <SeriesBrowser
            all={all}
            layout={layout}
            onLayout={chooseLayout}
            filter={filter}
            onFilter={setFilter}
            term={term}
            onTerm={setTerm}
            loading={query.isFetching}
            onRefresh={query.refetch}
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}

function SeriesBrowser({
  all,
  layout,
  onLayout,
  filter,
  onFilter,
  term,
  onTerm,
  loading,
  onRefresh,
}: {
  all: SeriesListItem[];
  layout: Layout;
  onLayout: (l: Layout) => void;
  filter: Filter;
  onFilter: (f: Filter) => void;
  term: string;
  onTerm: (v: string) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();

  // Colunas pela largura, não fixas: o mesmo código serve telefone em pé, deitado e tablet.
  const columns = layout === 'poster' ? Math.max(2, Math.floor(width / 170)) : 1;
  const gutter = Spacing[3];
  const posterWidth = (width - gutter * (columns + 1)) / columns;

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return all.filter((s) => {
      if (needle && !s.name.toLowerCase().includes(needle)) return false;
      if (filter === 'all') return true;
      const finished = SeriesCompletion.of({
        productionStatus: s.productionStatus,
        episodesTotal: s.episodesTotal,
        episodesWatched: s.episodesWatched,
      }).isFinished;
      return filter === 'finished' ? finished : !finished;
    });
  }, [all, term, filter]);

  const finishedCount = useMemo(
    () =>
      all.filter(
        (s) =>
          SeriesCompletion.of({
            productionStatus: s.productionStatus,
            episodesTotal: s.episodesTotal,
            episodesWatched: s.episodesWatched,
          }).isFinished,
      ).length,
    [all],
  );

  return (
    <FlatList
      // A key força a remontagem ao trocar o número de colunas — o FlatList não aceita
      // `numColumns` mudando no mesmo componente.
      key={`${layout}-${columns}`}
      data={shown}
      keyExtractor={(s) => String(s.id)}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? { gap: gutter, paddingHorizontal: gutter } : undefined}
      contentContainerStyle={[styles.list, columns > 1 ? { gap: gutter } : null]}
      refreshing={loading}
      onRefresh={onRefresh}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={[styles.eyebrow, { color: t.fgSubtle }]}>Acervo</Text>
          <Text style={[styles.title, { color: t.fg }]}>
            {shown.length === all.length
              ? `${all.length} séries`
              : `${shown.length} de ${all.length} séries`}
          </Text>

          <TextInput
            value={term}
            onChangeText={onTerm}
            placeholder="Buscar por nome"
            placeholderTextColor={t.fgSubtle}
            style={[
              styles.search,
              { color: t.fg, borderColor: t.borderStrong, backgroundColor: t.bgRaised },
            ]}
            accessibilityLabel="Buscar série por nome"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          <View style={styles.controls}>
            <Segmented
              label="Exibição"
              options={[
                { value: 'poster', label: 'Pôsteres' },
                { value: 'list', label: 'Lista' },
              ]}
              value={layout}
              onChange={(v) => onLayout(v as Layout)}
            />
            <Segmented
              label="Filtro"
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'unfinished', label: 'Em aberto' },
                { value: 'finished', label: `Finalizadas ${finishedCount}` },
              ]}
              value={filter}
              onChange={(v) => onFilter(v as Filter)}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: t.fgMuted }]}>Nenhuma série com esses critérios.</Text>
      }
      renderItem={({ item }) =>
        layout === 'poster' ? (
          <SeriesPoster item={item} width={posterWidth} />
        ) : (
          <SeriesRow item={item} />
        )
      }
      ItemSeparatorComponent={
        columns === 1
          ? () => <View style={[styles.separator, { backgroundColor: t.border }]} />
          : undefined
      }
    />
  );
}

/**
 * Grupo de escolha exclusiva. O selecionado combina fundo, peso e sublinhado — nunca só cor,
 * porque quem não distingue os dois tons precisa saber qual está ativo.
 */
function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${label}: ${o.label}`}
            style={[
              styles.segment,
              {
                backgroundColor: active ? t.accentQuiet : 'transparent',
                borderColor: active ? t.accent : t.border,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? t.fg : t.fgMuted, fontWeight: active ? '700' : '500' },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: Spacing[8] },
  head: { paddingHorizontal: Spacing[4], paddingTop: Spacing[5], paddingBottom: Spacing[4], gap: Spacing[3] },
  eyebrow: EyebrowStyle,
  title: { fontSize: FontSize.xl, fontWeight: '700' },
  search: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    fontSize: FontSize.base,
    minHeight: TouchTarget,
  },
  controls: { gap: Spacing[2] },
  segmented: { flexDirection: 'row', gap: Spacing[2], flexWrap: 'wrap' },
  segment: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  segmentText: { fontSize: FontSize.sm },
  empty: { padding: Spacing[4], fontSize: FontSize.base },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing[4] },
});
