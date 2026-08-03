/**
 * Busca — painel denso.
 *
 * <b>Resultados como registros.</b> Miniatura pequena, nome e ano na mesma linha, sinopse em uma
 * linha só e a ação à direita. Cabem oito resultados na tela onde o cinematográfico mostra dois —
 * e numa busca por nome, ver mais candidatos de uma vez é exatamente o que ajuda a escolher.
 *
 * <b>Esta tela não funciona sem rede, e não finge que funciona.</b> A busca vai ao TMDB e a adição
 * precisa trazer o catálogo de episódios. O resto do app continua legível offline; aqui o honesto
 * é dizer que não há resposta possível.
 */
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { formatSeriesStatus } from '@reprise/shared';
import type { SeriesSearchResult } from '@reprise/shared';
import { useAddSeries } from '@/api/queries';
import { Aviso, Poster } from '@/design/primitives';
import { useTokens } from '@/design/registry';
import { textoDoErro, useBusca } from '@/design/shared';

export default function PainelBusca() {
  const t = useTokens();
  const { termo, setTermo, query, curto } = useBusca();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={{ padding: t.shape.space(3), gap: t.shape.space(2) }}>
        <Text style={[t.shape.eyebrow, { color: t.fgSubtle }]}>Descobrir</Text>
        <Text style={[t.shape.title, { color: t.fg }]}>Buscar séries</Text>

        {/*
          Lupa dentro do campo, à esquerda; limpar à direita. É o padrão de todo sistema
          operacional e aqui carrega informação real: a lupa identifica o campo sem gastar uma
          linha de rótulo, e o "x" resolve o gesto mais frequente desta tela — recomeçar a busca.
        */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.shape.space(2),
            paddingHorizontal: t.shape.space(2),
            borderWidth: 1,
            borderColor: t.borderStrong,
            borderRadius: t.shape.radius.sm,
            backgroundColor: t.bgRaised,
          }}
        >
          <Ionicons name="search" size={16} color={t.fgSubtle} aria-hidden />
          <TextInput
            value={termo}
            onChangeText={setTermo}
            placeholder="Nome da série"
            placeholderTextColor={t.fgSubtle}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Nome da série"
            style={{ flex: 1, minHeight: 44, color: t.fg, fontSize: t.shape.font.base }}
          />
          {termo.length > 0 ? (
            <Pressable
              onPress={() => setTermo('')}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              // Alvo próprio: o glifo tem 16px e o dedo precisa de 44.
              hitSlop={14}
            >
              <Ionicons name="close-circle" size={16} color={t.fgSubtle} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {curto ? (
        <Aviso
          titulo="Digite para buscar"
          texto="Ao menos 2 caracteres. O que você adicionar entra na sua lista já com o catálogo de episódios."
        />
      ) : query.isPending ? (
        <View style={{ padding: t.shape.space(5) }}>
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
          contentContainerStyle={{ paddingBottom: t.shape.space(8) }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: t.border }} />
          )}
          renderItem={({ item }) => <Registro result={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function Registro({ result }: { result: SeriesSearchResult }) {
  const t = useTokens();
  const router = useRouter();
  const adicionar = useAddSeries();

  const pendente = adicionar.isPending && adicionar.variables === result.tmdbId;
  const falhou = adicionar.isError && adicionar.variables === result.tmdbId;
  const ano = result.firstAirDate ? result.firstAirDate.slice(0, 4) : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.shape.space(2),
        paddingHorizontal: t.shape.space(3),
        paddingVertical: t.shape.space(2),
        minHeight: 56,
      }}
    >
      {/* Proporção de pôster explícita: neste design o padrão dos tokens é quadrado, e capa
          quadrada corta cabeça e pés de todo cartaz. */}
      <Poster
        path={result.posterPath}
        nome={result.name}
        largura={36}
        aspect={2 / 3}
        chave={String(result.tmdbId)}
      />

      {/* `minWidth: 0` senão a sinopse longa empurra a coluna para fora da tela. */}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{ color: t.fg, fontSize: t.shape.font.base, fontWeight: '600' }}
          numberOfLines={1}
        >
          {result.name}
          {ano ? <Text style={{ color: t.fgSubtle, fontWeight: '400' }}> · {ano}</Text> : null}
        </Text>

        {result.overview ? (
          <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={1}>
            {result.overview}
          </Text>
        ) : null}

        {/* O erro fica na linha que o causou: com dez resultados, um aviso no topo não diz qual. */}
        {falhou ? (
          <Text style={{ color: t.danger, fontSize: t.shape.font.xs }} numberOfLines={2}>
            {textoDoErro(adicionar.error)}
          </Text>
        ) : null}
      </View>

      {/*
        Três situações, e colapsá-las em "Adicionar" mentiria em duas. O catálogo é global: a série
        pode existir aqui porque outra pessoa a trouxe, sem que você a acompanhe.
      */}
      {result.trackedStatus ? (
        result.seriesId ? (
          <Pressable
            onPress={() => router.push(`/series/${result.seriesId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${result.name}, ${formatSeriesStatus(result.trackedStatus)}`}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              alignItems: 'flex-end',
              paddingLeft: t.shape.space(2),
            }}
          >
            <Text style={{ color: t.fgMuted, fontSize: t.shape.font.xs }}>
              {formatSeriesStatus(result.trackedStatus)}
            </Text>
            <Text style={{ color: t.accent, fontSize: t.shape.font.xs, fontWeight: '700' }}>
              Abrir ›
            </Text>
          </Pressable>
        ) : (
          <View
            style={{ minHeight: 44, justifyContent: 'center' }}
            accessible
            accessibilityLabel={formatSeriesStatus(result.trackedStatus)}
          >
            <Text style={{ color: t.fgMuted, fontSize: t.shape.font.xs }}>
              {formatSeriesStatus(result.trackedStatus)}
            </Text>
          </View>
        )
      ) : (
        // Só ícone, e aqui isso se sustenta: "+" é a convenção mais estabelecida que existe para
        // adicionar, a ação é barata de desfazer (remover a série leva um toque no detalhe) e o
        // rótulo acessível carrega o nome da série. A regra de "ícone só acompanhando texto" vale
        // para o que custa caro errar — sair da conta, apagar —, não para isto.
        <Pressable
          onPress={() => adicionar.mutate(result.tmdbId)}
          disabled={adicionar.isPending}
          accessibilityRole="button"
          accessibilityLabel={`Adicionar ${result.name}`}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: t.accent,
            borderRadius: t.shape.radius.sm,
            backgroundColor: t.accentQuiet,
            opacity: adicionar.isPending ? 0.6 : 1,
          }}
        >
          {pendente ? (
            <ActivityIndicator size="small" color={t.accent} />
          ) : (
            <Ionicons name="add" size={20} color={t.accent} aria-hidden />
          )}
        </Pressable>
      )}
    </View>
  );
}
