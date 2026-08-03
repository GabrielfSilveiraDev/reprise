/**
 * Séries — cinematográfico.
 *
 * Mural de capas coladas, sem moldura e sem nome embaixo. O acervo vira parede de arte, e o nome
 * só aparece quando a capa falta — que é justamente quando ele é necessário.
 *
 * Os controles (busca e filtro) ficam em fita fina no topo, não em bloco: neste design qualquer
 * pixel gasto com interface é pixel roubado da imagem.
 */
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { SeriesCompletion } from '@reprise/shared';
import type { SeriesListItem } from '@reprise/shared';
import { useSeriesList } from '@/api/queries';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { LocalStore } from '@/offline/local-store';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { Poster, Progresso } from '@/design/primitives';
import { useTokens } from '@/design/registry';

type Filtro = 'all' | 'unfinished' | 'finished';
const FILTRO_SETTING = 'cinemaSeriesFilter';

function concluida(s: SeriesListItem): boolean {
  return SeriesCompletion.of({
    productionStatus: s.productionStatus,
    episodesTotal: s.episodesTotal,
    episodesWatched: s.episodesWatched,
  }).isFinished;
}

export default function CinemaSeries() {
  const t = useTokens();
  const status = useAutoSync();
  const query = useSeriesList();
  const { width } = useWindowDimensions();

  const [termo, setTermo] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('all');

  // O filtro fica guardado como no clássico: reajustar a cada abertura seria pior que não ter.
  useEffect(() => {
    LocalStore.open().then(async (store) => {
      const salvo = await store.getSetting(FILTRO_SETTING);
      if (salvo === 'all' || salvo === 'unfinished' || salvo === 'finished') setFiltro(salvo);
    });
  }, []);

  const escolherFiltro = (f: Filtro) => {
    setFiltro(f);
    LocalStore.open().then((store) => store.setSetting(FILTRO_SETTING, f));
  };

  const colunas = Math.max(3, Math.floor(width / 130));
  const largura = width / colunas;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {(todas) => {
          const agulha = termo.trim().toLowerCase();
          const vistas = todas.filter((s) => {
            if (agulha && !s.name.toLowerCase().includes(agulha)) return false;
            if (filtro === 'all') return true;
            return filtro === 'finished' ? concluida(s) : !concluida(s);
          });

          return (
            <FlatList
              key={colunas}
              data={vistas}
              numColumns={colunas}
              keyExtractor={(s) => String(s.id)}
              refreshing={query.isFetching}
              onRefresh={query.refetch}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View style={{ padding: t.shape.space(4), gap: t.shape.space(3) }}>
                  <Text style={[t.shape.title, { color: t.fg }]}>
                    {vistas.length === todas.length
                      ? `${todas.length} séries`
                      : `${vistas.length} de ${todas.length}`}
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: t.shape.space(2),
                      borderBottomWidth: 1,
                      borderBottomColor: t.border,
                      paddingBottom: t.shape.space(1),
                    }}
                  >
                    <Ionicons name="search" size={18} color={t.fgSubtle} aria-hidden />
                    <TextInput
                      value={termo}
                      onChangeText={setTermo}
                      placeholder="Filtrar por nome"
                      placeholderTextColor={t.fgSubtle}
                      autoCorrect={false}
                      accessibilityLabel="Filtrar séries por nome"
                      style={{ flex: 1, minHeight: 44, color: t.fg, fontSize: t.shape.font.base }}
                    />
                    {termo ? (
                      <Pressable
                        onPress={() => setTermo('')}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Limpar filtro"
                      >
                        <Ionicons name="close-circle" size={18} color={t.fgSubtle} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', gap: t.shape.space(4) }}>
                    {(
                      [
                        ['all', 'Todas'],
                        ['unfinished', 'Em aberto'],
                        ['finished', 'Finalizadas'],
                      ] as const
                    ).map(([valor, rotulo]) => {
                      const ativo = filtro === valor;
                      return (
                        <Pressable
                          key={valor}
                          onPress={() => escolherFiltro(valor)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: ativo }}
                          accessibilityLabel={rotulo}
                          style={{ minHeight: 44, justifyContent: 'center' }}
                        >
                          {/* Peso + cor + sublinhado: "onde estou" nunca depende só do tom. */}
                          <Text
                            style={{
                              color: ativo ? t.accent : t.fgSubtle,
                              fontSize: t.shape.font.sm,
                              fontWeight: ativo ? '800' : '500',
                              borderBottomWidth: ativo ? 2 : 0,
                              borderBottomColor: t.accent,
                              paddingBottom: 2,
                            }}
                          >
                            {rotulo}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              }
              ListEmptyComponent={
                <Text
                  style={{
                    color: t.fgMuted,
                    fontSize: t.shape.font.base,
                    padding: t.shape.space(6),
                  }}
                >
                  Nenhuma série com esses critérios.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/series/${item.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${Math.round(item.completionRatio * 100)} por cento`}
                  style={{ width: largura }}
                >
                  <Poster
                    path={item.posterPath}
                    nome={item.name}
                    largura={largura}
                    radius={0}
                    chave={String(item.id)}
                  />
                  {/* A barra colada no pé da capa é a única interface sobre a arte: diz o
                      progresso sem gastar uma linha de texto. */}
                  <View style={{ marginTop: -3 }}>
                    <Progresso
                      ratio={item.completionRatio}
                      altura={3}
                      cor={concluida(item) ? t.state.finished : t.state.progress}
                    />
                  </View>
                </Pressable>
              )}
            />
          );
        }}
      </QueryState>
    </SafeAreaView>
  );
}
