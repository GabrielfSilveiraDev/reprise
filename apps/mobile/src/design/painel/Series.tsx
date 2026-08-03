/**
 * Séries — painel denso.
 *
 * <b>Tabela, com cabeçalho que ordena.</b> Uma linha por série, sem capa: nome, progresso em barra
 * e em número, e quantos faltam. Onde o cinematográfico faz mural e o editorial faz índice
 * alfabético, aqui o acervo é um conjunto de dados — e a pergunta que um conjunto de dados
 * responde bem é "quais estão mais atrasadas?", que nenhuma ordem alfabética responde.
 *
 * <b>Por isso a ordenação existe só neste design.</b> Não é enfeite: ela é o que transforma 116
 * linhas iguais em resposta. Ordenar por "faltam" põe no topo o que exige decisão; por progresso,
 * o que está quase acabando. A escolha fica guardada, como o filtro.
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { SeriesListItem } from '@reprise/shared';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { Progresso } from '@/design/primitives';
import { useTokens } from '@/design/registry';
import { acervoConcluido, useAcervo } from '@/design/shared';

type Ordem = 'nome' | 'progresso' | 'faltam';

const ORDENS: ReadonlyArray<{ id: Ordem; rotulo: string }> = [
  { id: 'nome', rotulo: 'Nome' },
  { id: 'progresso', rotulo: '%' },
  { id: 'faltam', rotulo: 'Faltam' },
];

function faltam(s: SeriesListItem): number {
  // Contra `episodesAired`, não `episodesTotal`: episódio agendado não é episódio em atraso.
  return Math.max(0, s.episodesAired - s.episodesWatched);
}

export default function PainelSeries() {
  const t = useTokens();
  const status = useAutoSync();
  const { query, todas, vistas, termo, setTermo, filtro, escolherFiltro, finalizadas } =
    useAcervo('painelSeriesFilter');

  const [ordem, setOrdem] = useState<Ordem>('nome');

  const linhas = useMemo(() => {
    const copia = [...vistas];
    if (ordem === 'nome') copia.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (ordem === 'progresso') copia.sort((a, b) => b.completionRatio - a.completionRatio);
    if (ordem === 'faltam') copia.sort((a, b) => faltam(b) - faltam(a));
    return copia;
  }, [vistas, ordem]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {() => (
          <FlatList
            data={linhas}
            keyExtractor={(s) => String(s.id)}
            refreshing={query.isFetching}
            onRefresh={query.refetch}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: t.shape.space(8) }}
            ListHeaderComponent={
              <View style={{ padding: t.shape.space(3), gap: t.shape.space(2) }}>
                <Text style={[t.shape.eyebrow, { color: t.fgSubtle }]}>Acervo</Text>
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
                    paddingHorizontal: t.shape.space(2),
                    borderWidth: 1,
                    borderColor: t.border,
                    borderRadius: t.shape.radius.sm,
                    backgroundColor: t.bgRaised,
                  }}
                >
                  <Ionicons name="search" size={16} color={t.fgSubtle} aria-hidden />
                  <TextInput
                    value={termo}
                    onChangeText={setTermo}
                    placeholder="Filtrar por nome"
                    placeholderTextColor={t.fgSubtle}
                    autoCorrect={false}
                    accessibilityLabel="Filtrar séries por nome"
                    style={{
                      flex: 1,
                      minHeight: 44,
                      color: t.fg,
                      fontSize: t.shape.font.base,
                    }}
                  />
                  {termo ? (
                    <Pressable
                      onPress={() => setTermo('')}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel="Limpar filtro"
                    >
                      <Ionicons name="close-circle" size={16} color={t.fgSubtle} />
                    </Pressable>
                  ) : null}
                </View>

                <Grupo
                  rotulo="Filtro"
                  opcoes={[
                    { id: 'all', rotulo: 'Todas' },
                    { id: 'unfinished', rotulo: 'Em aberto' },
                    { id: 'finished', rotulo: `Finalizadas ${finalizadas}` },
                  ]}
                  valor={filtro}
                  onEscolher={(v) => escolherFiltro(v as 'all' | 'unfinished' | 'finished')}
                />

                <Grupo
                  rotulo="Ordenar por"
                  opcoes={ORDENS.map((o) => ({ id: o.id, rotulo: o.rotulo }))}
                  valor={ordem}
                  onEscolher={(v) => setOrdem(v as Ordem)}
                />
              </View>
            }
            ListEmptyComponent={
              <Text
                style={{
                  color: t.fgMuted,
                  fontSize: t.shape.font.base,
                  padding: t.shape.space(4),
                }}
              >
                Nenhuma série com esses critérios.
              </Text>
            }
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: t.border }} />
            )}
            renderItem={({ item }) => <LinhaDaTabela item={item} />}
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}

/** Grupo de escolha exclusiva, compacto. Fundo + peso + borda: nunca só cor. */
function Grupo({
  rotulo,
  opcoes,
  valor,
  onEscolher,
}: {
  rotulo: string;
  opcoes: ReadonlyArray<{ id: string; rotulo: string }>;
  valor: string;
  onEscolher: (v: string) => void;
}) {
  const t = useTokens();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.shape.space(2) }}
      accessibilityRole="radiogroup"
      accessibilityLabel={rotulo}
    >
      <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs, width: 64 }}>{rotulo}</Text>
      <View style={{ flexDirection: 'row', gap: t.shape.space(1), flex: 1, flexWrap: 'wrap' }}>
        {opcoes.map((o) => {
          const ativo = o.id === valor;
          return (
            <Pressable
              key={o.id}
              onPress={() => onEscolher(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={`${rotulo}: ${o.rotulo}`}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: t.shape.space(2),
                borderWidth: 1,
                borderRadius: t.shape.radius.sm,
                borderColor: ativo ? t.accent : t.border,
                backgroundColor: ativo ? t.accentQuiet : 'transparent',
              }}
            >
              <Text
                style={{
                  color: ativo ? t.fg : t.fgMuted,
                  fontSize: t.shape.font.xs,
                  fontWeight: ativo ? '700' : '500',
                }}
              >
                {o.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LinhaDaTabela({ item }: { item: SeriesListItem }) {
  const t = useTokens();
  const concluida = acervoConcluido(item);
  const restantes = faltam(item);

  return (
    <Pressable
      onPress={() => router.push(`/series/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.episodesWatched} de ${item.episodesTotal} episódios${restantes > 0 ? `, faltam ${restantes}` : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.shape.space(2),
        paddingHorizontal: t.shape.space(3),
        paddingVertical: t.shape.space(2),
        minHeight: 48,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          style={{ color: t.fg, fontSize: t.shape.font.base, fontWeight: '600' }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Progresso
          ratio={item.completionRatio}
          altura={3}
          cor={concluida ? t.state.finished : t.state.progress}
        />
      </View>

      {/* Coluna de largura fixa: com números tabulares, as casas alinham entre linhas e a coluna
          vira uma coluna de verdade, não um texto encostado à direita. */}
      <View style={{ width: 76, alignItems: 'flex-end' }}>
        <Text
          style={{
            color: t.fg,
            fontSize: t.shape.font.sm,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
          }}
        >
          {item.episodesWatched}/{item.episodesTotal}
        </Text>
        <Text
          style={{
            color: restantes > 0 ? t.state.progress : t.fgSubtle,
            fontSize: t.shape.font.xs,
            fontVariant: ['tabular-nums'],
          }}
        >
          {restantes > 0 ? `faltam ${restantes}` : concluida ? 'completa' : 'em dia'}
        </Text>
      </View>
    </Pressable>
  );
}
