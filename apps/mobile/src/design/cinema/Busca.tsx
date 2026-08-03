/**
 * Busca — cinematográfico.
 *
 * <b>O cartaz é o resultado.</b> Cada achado ocupa a largura toda com a capa grande à esquerda,
 * sem moldura, sem cartão e sem fundo próprio: a lista parece uma parede de cartazes de cinema, e
 * é a imagem que você varre, não o texto.
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
import { TouchTarget } from '@/constants/theme';
import { Aviso, Botao, Poster } from '@/design/primitives';
import { useTokens } from '@/design/registry';
import { textoDoErro, useBusca } from '@/design/shared';

export default function CinemaBusca() {
  const t = useTokens();
  const { termo, setTermo, query, curto } = useBusca('w342');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={{ padding: t.shape.space(4), gap: t.shape.space(3) }}>
        <Text style={[t.shape.title, { color: t.fg }]}>Buscar</Text>

        {/*
          Fio embaixo em vez de caixa. Uma caixa desenhada é mais um retângulo de interface
          disputando espaço com a imagem, e neste design a interface cede.
        */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.shape.space(2),
            borderBottomWidth: 1,
            borderBottomColor: t.borderStrong,
          }}
        >
          <Ionicons name="search" size={20} color={t.fgSubtle} aria-hidden />
          <TextInput
            value={termo}
            onChangeText={setTermo}
            placeholder="Nome da série"
            placeholderTextColor={t.fgSubtle}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Nome da série"
            style={{
              flex: 1,
              minHeight: TouchTarget,
              color: t.fg,
              fontSize: t.shape.font.lg,
            }}
          />
          {termo.length > 0 ? (
            <Pressable
              onPress={() => setTermo('')}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              // Alvo próprio: o glifo tem 20px e o dedo precisa de 44.
              hitSlop={12}
            >
              <Ionicons name="close-circle" size={20} color={t.fgSubtle} />
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
          contentContainerStyle={{ paddingBottom: t.shape.space(8) }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: t.border }} />
          )}
          renderItem={({ item }) => <Cartaz result={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function Cartaz({ result }: { result: SeriesSearchResult }) {
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
        gap: t.shape.space(3),
        padding: t.shape.space(3),
      }}
    >
      <Poster
        path={result.posterPath}
        nome={result.name}
        largura={104}
        radius={0}
        chave={String(result.tmdbId)}
      />

      {/* `minWidth: 0` senão a sinopse longa empurra a coluna para fora da tela. */}
      <View style={{ flex: 1, minWidth: 0, gap: t.shape.space(1) }}>
        <Text
          style={{
            color: t.fg,
            fontSize: t.shape.font.lg,
            fontWeight: '800',
            letterSpacing: -0.3,
          }}
          numberOfLines={2}
        >
          {result.name}
        </Text>

        {ano ? (
          <Text style={[t.shape.section, { color: t.fgSubtle }]}>{ano}</Text>
        ) : null}

        {result.overview ? (
          <Text
            style={{ color: t.fgMuted, fontSize: t.shape.font.sm, lineHeight: 20 }}
            numberOfLines={3}
          >
            {result.overview}
          </Text>
        ) : null}

        {/*
          Três situações, e colapsá-las em "Adicionar" mentiria em duas. O catálogo é global: a
          série pode existir aqui porque outra pessoa a trouxe, sem que você a acompanhe.
        */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.shape.space(2),
            marginTop: t.shape.space(1),
          }}
        >
          {result.trackedStatus ? (
            <>
              {/* View com Text dentro, não Text com fundo: a altura de um Text é ditada pela
                  linha do tipo, e ele nunca acompanharia a altura do botão ao lado. */}
              <View
                style={{
                  minHeight: TouchTarget,
                  paddingHorizontal: t.shape.space(3),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: t.accentQuiet,
                }}
              >
                <Text style={{ color: t.fg, fontSize: t.shape.font.sm, fontWeight: '700' }}>
                  {formatSeriesStatus(result.trackedStatus)}
                </Text>
              </View>
              {result.seriesId ? (
                <Botao
                  titulo="Abrir"
                  variante="contorno"
                  icone="arrow-forward"
                  onPress={() => router.push(`/series/${result.seriesId}`)}
                />
              ) : null}
            </>
          ) : (
            <Botao
              titulo="Adicionar"
              icone="add"
              ocupado={pendente}
              onPress={() => adicionar.mutate(result.tmdbId)}
            />
          )}
        </View>

        {/* O erro fica na linha que o causou: com dez resultados, um aviso no topo não diz qual. */}
        {falhou ? (
          <Text style={{ color: t.danger, fontSize: t.shape.font.sm }}>
            {textoDoErro(adicionar.error)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
