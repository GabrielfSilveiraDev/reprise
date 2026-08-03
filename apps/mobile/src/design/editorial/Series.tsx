/**
 * Séries — editorial.
 *
 * <b>Índice de revista, não vitrine.</b> O acervo vira uma lista alfabética com capitulares: a
 * letra é o marco de navegação, o nome da série é a entrada e o progresso é a linha fina embaixo.
 * Rolar 116 séries procurando uma específica é a tarefa real desta tela — e um mural de capas, que
 * é o que os outros designs oferecem, obriga a reconhecer pela imagem em vez de ler pelo nome.
 *
 * <b>Ordem alfabética, e não por atividade.</b> Um índice ordenado por recência é um índice que
 * muda de lugar entre duas aberturas, e aí ele deixa de ser índice. Quem quer "o que assisti por
 * último" tem a tela Próximos inteira para isso.
 *
 * A miniatura fica pequena e à direita: reconhecimento, nunca protagonismo.
 */
import { useMemo } from 'react';
import { Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { formatPercent } from '@reprise/shared';
import type { SeriesListItem } from '@reprise/shared';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { Poster } from '@/design/primitives';
import { useTokens } from '@/design/registry';
import { acervoConcluido, useAcervo } from '@/design/shared';

/** A capitular de uma série. Número e símbolo caem todos em "#", senão o índice teria 30 letras. */
function inicial(nome: string): string {
  const c = nome.trim().charAt(0).toUpperCase();
  return /[A-ZÀ-Ú]/.test(c) ? c : '#';
}

export default function EditorialSeries() {
  const t = useTokens();
  const status = useAutoSync();
  const { query, todas, vistas, termo, setTermo, filtro, escolherFiltro, finalizadas } =
    useAcervo('editorialSeriesFilter');

  const secoes = useMemo(() => {
    const mapa = new Map<string, SeriesListItem[]>();
    for (const s of [...vistas].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))) {
      const letra = inicial(s.name);
      const lista = mapa.get(letra);
      if (lista) lista.push(s);
      else mapa.set(letra, [s]);
    }
    return [...mapa.entries()].map(([letra, data]) => ({ letra, data }));
  }, [vistas]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {() => (
          <SectionList
            sections={secoes}
            keyExtractor={(s) => String(s.id)}
            refreshing={query.isFetching}
            onRefresh={query.refetch}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled
            contentContainerStyle={{
              paddingHorizontal: t.shape.space(4),
              paddingBottom: t.shape.space(8),
            }}
            ListHeaderComponent={
              <View style={{ paddingVertical: t.shape.space(5), gap: t.shape.space(3) }}>
                <Text style={[t.shape.eyebrow, { color: t.accent }]}>Acervo</Text>
                <Text style={[t.shape.title, { color: t.fg }]}>
                  {vistas.length === todas.length
                    ? `${todas.length} séries`
                    : `${vistas.length} de ${todas.length}`}
                </Text>

                {/* Campo sem caixa: um fio embaixo basta para dizer onde se escreve, e caixa
                    desenhada é justamente o que este design troca por tipografia. */}
                <TextInput
                  value={termo}
                  onChangeText={setTermo}
                  placeholder="Buscar por nome"
                  placeholderTextColor={t.fgSubtle}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  accessibilityLabel="Buscar série por nome"
                  style={{
                    minHeight: 48,
                    color: t.fg,
                    fontSize: t.shape.font.base,
                    borderBottomWidth: 1,
                    borderBottomColor: t.fg,
                  }}
                />

                <View
                  style={{ flexDirection: 'row', gap: t.shape.space(4), flexWrap: 'wrap' }}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Filtro"
                >
                  {(
                    [
                      ['all', 'Todas'],
                      ['unfinished', 'Em aberto'],
                      ['finished', `Finalizadas ${finalizadas}`],
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
                            color: ativo ? t.fg : t.fgMuted,
                            fontSize: t.shape.font.sm,
                            fontWeight: ativo ? '700' : '400',
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
                  paddingVertical: t.shape.space(5),
                }}
              >
                Nenhuma série com esses critérios.
              </Text>
            }
            renderSectionHeader={({ section }) => (
              <View
                style={{
                  backgroundColor: t.bg,
                  paddingTop: t.shape.space(4),
                  paddingBottom: t.shape.space(1),
                  borderBottomWidth: 1,
                  borderBottomColor: t.fg,
                }}
              >
                <Text
                  style={{
                    color: t.accent,
                    fontSize: t.shape.font.xl,
                    fontWeight: '700',
                    letterSpacing: -0.5,
                  }}
                >
                  {section.letra}
                </Text>
              </View>
            )}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: t.border }} />
            )}
            renderItem={({ item }) => <Entrada item={item} />}
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}

function Entrada({ item }: { item: SeriesListItem }) {
  const t = useTokens();
  const concluida = acervoConcluido(item);

  return (
    <Pressable
      onPress={() => router.push(`/series/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.episodesWatched} de ${item.episodesTotal} episódios`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.shape.space(3),
        paddingVertical: t.shape.space(3),
        minHeight: 56,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: t.shape.space(1) }}>
        <Text
          style={{
            color: t.fg,
            fontSize: t.shape.font.lg,
            fontWeight: '700',
            letterSpacing: -0.3,
            lineHeight: t.shape.font.lg * 1.25,
          }}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        {/* O progresso escrito, não desenhado: uma barra aqui seria o único elemento gráfico da
            tela, e este design hierarquiza por texto. A palavra "completa" carrega o estado
            sozinha — cor nunca é o único canal. */}
        <Text
          style={{
            color: t.fgSubtle,
            fontSize: t.shape.font.sm,
            fontVariant: ['tabular-nums'],
          }}
        >
          {item.episodesWatched}/{item.episodesTotal} · {formatPercent(item.completionRatio)}
          {concluida ? ' · completa' : ''}
        </Text>
      </View>

      <Poster path={item.posterPath} nome={item.name} largura={44} chave={String(item.id)} />
    </Pressable>
  );
}
