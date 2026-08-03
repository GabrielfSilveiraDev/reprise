/**
 * Busca — editorial.
 *
 * <b>Cada resultado é uma chamada de matéria.</b> Manchete, ano em linha fina, olho de três linhas
 * e um fio embaixo. A capa é miniatura à direita porque aqui quem decide é o texto: você reconhece
 * a série pelo nome e pela sinopse, e a imagem só confirma.
 *
 * <b>Esta tela não funciona sem rede, e não finge que funciona.</b> A busca vai ao TMDB e a adição
 * precisa trazer o catálogo de episódios. O resto do app continua legível offline; aqui o honesto
 * é dizer que não há resposta possível.
 */
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatSeriesStatus } from '@reprise/shared';
import type { SeriesSearchResult } from '@reprise/shared';
import { useAddSeries } from '@/api/queries';
import { Aviso, Botao, Poster } from '@/design/primitives';
import { useTokens } from '@/design/registry';
import { textoDoErro, useBusca } from '@/design/shared';

export default function EditorialBusca() {
  const t = useTokens();
  const { termo, setTermo, query, curto } = useBusca();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View
        style={{
          paddingHorizontal: t.shape.space(4),
          paddingTop: t.shape.space(5),
          paddingBottom: t.shape.space(3),
          gap: t.shape.space(3),
        }}
      >
        <Text style={[t.shape.eyebrow, { color: t.accent }]}>Descobrir</Text>
        <Text style={[t.shape.title, { color: t.fg }]}>Buscar séries</Text>

        {/* Fio grosso embaixo, sem caixa e sem lupa: o rótulo acima já diz o que se faz aqui, e um
            ícone repetiria a mesma informação ocupando espaço de respiro. */}
        <TextInput
          value={termo}
          onChangeText={setTermo}
          placeholder="Nome da série"
          placeholderTextColor={t.fgSubtle}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Nome da série"
          style={{
            minHeight: 48,
            color: t.fg,
            fontSize: t.shape.font.lg,
            borderBottomWidth: 2,
            borderBottomColor: t.fg,
          }}
        />
      </View>

      {curto ? (
        <Aviso
          titulo="Digite para buscar"
          texto="Ao menos 2 caracteres. O que você adicionar entra na sua lista já com o catálogo de episódios."
        />
      ) : query.isPending ? (
        <View style={{ padding: t.shape.space(6) }}>
          <ActivityIndicator color={t.accent} />
        </View>
      ) : query.isError ? (
        <Aviso
          titulo="Não deu para buscar"
          texto={`A busca precisa de rede e de uma chave do TMDB configurada no servidor. ${textoDoErro(query.error)}`}
        />
      ) : query.data.length === 0 ? (
        <Aviso titulo="Nenhuma série encontrada" texto="Tente o título original, ou em inglês." />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(r) => String(r.tmdbId)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: t.shape.space(4),
            paddingBottom: t.shape.space(8),
          }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: t.border }} />
          )}
          renderItem={({ item }) => <Chamada result={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function Chamada({ result }: { result: SeriesSearchResult }) {
  const t = useTokens();
  const router = useRouter();
  const adicionar = useAddSeries();

  const pendente = adicionar.isPending && adicionar.variables === result.tmdbId;
  const falhou = adicionar.isError && adicionar.variables === result.tmdbId;
  const ano = result.firstAirDate ? result.firstAirDate.slice(0, 4) : null;

  return (
    <View style={{ paddingVertical: t.shape.space(4), gap: t.shape.space(3) }}>
      <View style={{ flexDirection: 'row', gap: t.shape.space(3), alignItems: 'flex-start' }}>
        {/* `minWidth: 0` senão a sinopse longa empurra a coluna para fora da tela. */}
        <View style={{ flex: 1, minWidth: 0, gap: t.shape.space(1) }}>
          <Text
            style={{
              color: t.fg,
              fontSize: t.shape.font.lg,
              fontWeight: '700',
              letterSpacing: -0.3,
              lineHeight: t.shape.font.lg * 1.25,
            }}
            numberOfLines={3}
          >
            {result.name}
          </Text>

          {ano || result.originalName ? (
            <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.sm }} numberOfLines={1}>
              {[ano, result.originalName !== result.name ? result.originalName : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}

          {result.overview ? (
            <Text
              style={{
                color: t.fgMuted,
                fontSize: t.shape.font.sm,
                lineHeight: t.shape.font.sm * 1.6,
              }}
              numberOfLines={3}
            >
              {result.overview}
            </Text>
          ) : null}
        </View>

        <Poster
          path={result.posterPath}
          nome={result.name}
          largura={56}
          chave={String(result.tmdbId)}
        />
      </View>

      {/*
        Três situações, e colapsá-las em "Adicionar" mentiria em duas. O catálogo é global: a série
        pode existir aqui porque outra pessoa a trouxe, sem que você a acompanhe.
      */}
      {result.trackedStatus ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.shape.space(3) }}>
          <Text style={[t.shape.section, { color: t.accent }]}>
            {formatSeriesStatus(result.trackedStatus)}
          </Text>
          {result.seriesId ? (
            <Pressable
              onPress={() => router.push(`/series/${result.seriesId}`)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${result.name}`}
              style={{ minHeight: 48, justifyContent: 'center' }}
            >
              <Text
                style={{
                  color: t.fg,
                  fontSize: t.shape.font.sm,
                  fontWeight: '700',
                  borderBottomWidth: 1,
                  borderBottomColor: t.fg,
                }}
              >
                Abrir →
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Botao
          titulo="Adicionar à minha lista"
          icone="add"
          ocupado={pendente}
          onPress={() => adicionar.mutate(result.tmdbId)}
        />
      )}

      {/* O erro fica na linha que o causou: com dez resultados, um aviso no topo não diz qual. */}
      {falhou ? (
        <Text style={{ color: t.danger, fontSize: t.shape.font.sm }}>
          {textoDoErro(adicionar.error)}
        </Text>
      ) : null}
    </View>
  );
}
