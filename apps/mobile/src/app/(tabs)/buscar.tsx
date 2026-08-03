import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { formatSeriesStatus, posterUrl } from '@reprise/shared';
import type { SeriesSearchResult } from '@reprise/shared';
import { useAddSeries, useSeriesSearch } from '@/api/queries';
import CinemaBusca from '@/design/cinema/Busca';
import EditorialBusca from '@/design/editorial/Busca';
import PainelBusca from '@/design/painel/Busca';
import { useDesign } from '@/design/registry';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A rota é uma casca: quem desenha é o design escolhido em Ajustes.
 *
 * O desenho clássico continua morando neste arquivo, logo abaixo. Os outros três vivem em
 * `@/design/<id>/`, e um design desconhecido cai aqui — é o que garante que o app abra mesmo com a
 * preferência corrompida.
 */
export default function BuscarRoute() {
  const { design } = useDesign();
  if (design === 'cinema') return <CinemaBusca />;
  if (design === 'editorial') return <EditorialBusca />;
  if (design === 'painel') return <PainelBusca />;
  return <ClassicoBusca />;
}

/**
 * O termo, alguns instantes depois de parar de digitar.
 *
 * Num teclado de celular cada letra é um evento, e cada busca custa duas requisições ao TMDB no
 * servidor. Sem o atraso, "severance" viraria dezoito requisições para chegar ao mesmo resultado
 * da última tecla.
 */
function useDebounced(value: string, delayMs = 400): string {
  const [atrasado, setAtrasado] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setAtrasado(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return atrasado;
}

/**
 * A capa, com a inicial da série por baixo.
 *
 * <b>A inicial não é só o caso "sem capa": ela é o estado de carregamento.</b> Antes, quando havia
 * capa, a linha mostrava um retângulo vazio até a imagem chegar — e retângulo vazio é
 * indistinguível de imagem que falhou. Desenhando a inicial SEMPRE e deixando a capa entrar por
 * cima, nunca existe um quadro em branco: a linha já nasce legível e a imagem só a substitui.
 *
 * O que demora aqui não é a imagem, é a conexão. Uma capa em w154 tem ~7 KB — menos que o
 * cabeçalho de muitas requisições —, mas o aperto de mão TLS com o CDN do TMDB custa uns 300 ms.
 * Nenhum tamanho menor resolve isso, e é por isso que a resposta certa é `prefetch` (começar cedo)
 * mais este placeholder (não deixar buraco enquanto começa).
 */
function Poster({ result }: { result: SeriesSearchResult }) {
  const t = useTheme();
  const src = posterUrl(result.posterPath, 'w154');

  return (
    <View style={[styles.poster, { backgroundColor: t.bgSunken }]}>
      <Text style={[styles.posterInicial, { color: t.fgSubtle }]}>
        {result.name.trim().charAt(0).toUpperCase()}
      </Text>

      {src ? (
        <Image
          source={{ uri: src }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          // Disco além da memória: repetir a mesma busca — e é o que se faz ao voltar para a aba —
          // não deve pagar a rede de novo.
          cachePolicy="memory-disk"
          // A FlatList recicla as linhas. Sem esta chave, a linha reaproveitada exibe por um
          // instante a capa da série ANTERIOR, que é pior do que exibir nada.
          recyclingKey={String(result.tmdbId)}
          priority="high"
        />
      ) : null}
    </View>
  );
}

function Hit({ result }: { result: SeriesSearchResult }) {
  const t = useTheme();
  const router = useRouter();
  const adicionar = useAddSeries();

  const pendente = adicionar.isPending && adicionar.variables === result.tmdbId;
  const falhou = adicionar.isError && adicionar.variables === result.tmdbId;
  const ano = result.firstAirDate ? result.firstAirDate.slice(0, 4) : null;

  return (
    <View style={[styles.hit, { backgroundColor: t.bgRaised, borderColor: t.border }]}>
      <Poster result={result} />

      <View style={styles.texto}>
        <Text style={[styles.nome, { color: t.fg }]} numberOfLines={2}>
          {result.name}
          {ano ? <Text style={{ color: t.fgMuted, fontWeight: '400' }}> ({ano})</Text> : null}
        </Text>

        {result.overview ? (
          <Text style={[styles.sinopse, { color: t.fgMuted }]} numberOfLines={3}>
            {result.overview}
          </Text>
        ) : null}

        {/*
          Três situações, e colapsá-las em "Adicionar" mentiria em duas. O catálogo é global: a
          série pode existir aqui porque outra pessoa a trouxe, sem que você a acompanhe.
        */}
        {result.trackedStatus ? (
          <View style={styles.acoes}>
            {/*
              O selo é um View com Text dentro, não um Text com fundo.
              Altura de Text é ditada pela linha do tipo, então ele nunca acompanharia a altura do
              botão ao lado — era daí que vinha o degrau entre "Acompanhando" e "Abrir". Envolvido,
              ele obedece ao mesmo `minHeight` do botão e os dois assentam na mesma linha de base.
            */}
            <View style={[styles.selo, { backgroundColor: t.accentQuiet }]}>
              <Text style={[styles.seloTexto, { color: t.accentFg }]}>
                {formatSeriesStatus(result.trackedStatus)}
              </Text>
            </View>
            {result.seriesId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/series/${result.seriesId}`)}
                style={[styles.botao, { borderColor: t.borderStrong }]}
              >
                <Text style={{ color: t.fg, fontSize: FontSize.sm }}>Abrir</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.acoes}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Adicionar ${result.name}`}
              disabled={adicionar.isPending}
              onPress={() => adicionar.mutate(result.tmdbId)}
              style={[styles.botao, styles.botaoPrimario, { backgroundColor: t.accent }]}
            >
              {pendente ? (
                <ActivityIndicator color={t.accentFg} size="small" />
              ) : (
                <Text style={{ color: t.accentFg, fontSize: FontSize.sm, fontWeight: '700' }}>
                  Adicionar
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {/* O erro fica na linha que o causou: com dez resultados, um aviso no topo não diz qual. */}
        {falhou ? (
          <Text style={[styles.erro, { color: t.danger }]}>
            {adicionar.error instanceof Error ? adicionar.error.message : 'Não deu para adicionar.'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Busca de séries novas — a porta de entrada que não passa pelo importador do TV Time.
 *
 * Diferente das outras abas, esta **não funciona sem rede**, e não finge que funciona: a busca vai
 * ao TMDB e a adição precisa trazer o catálogo de episódios. O resto do app continua legível
 * offline; aqui o honesto é dizer que não há resposta possível.
 */
function ClassicoBusca() {
  const t = useTheme();
  const [termo, setTermo] = useState('');
  const termoBuscado = useDebounced(termo);
  const query = useSeriesSearch(termoBuscado);

  const curto = termoBuscado.trim().length < 2;

  /*
    Puxa TODAS as capas assim que a lista chega, sem esperar cada linha entrar em tela.

    A FlatList só monta o que está visível, então sem isto a capa do sétimo resultado só começa a
    ser baixada quando você rola até ele — e aí você espera de novo o mesmo aperto de mão TLS que
    já esperou no primeiro. Disparando tudo junto, a conexão com o CDN é estabelecida uma vez e as
    demais imagens descem por ela enquanto você ainda lê o primeiro resultado.

    São ~7 KB por capa e no máximo 20 por busca: menos de 150 KB para a lista inteira. Não vale a
    pena ser econômico aqui, e o `prefetch` grava no mesmo cache que o componente lê depois.
  */
  useEffect(() => {
    const capas = (query.data ?? [])
      .map((r) => posterUrl(r.posterPath, 'w154'))
      .filter((u): u is string => Boolean(u));

    if (capas.length > 0) {
      // Sem `await` e sem tratar a falha: é adiantamento, não requisito. Se falhar, o componente
      // pede a imagem normalmente quando a linha aparecer.
      void Image.prefetch(capas, { cachePolicy: 'memory-disk' });
    }
  }, [query.data]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.cabecalho}>
        <Text style={[styles.titulo, { color: t.fg }]}>Buscar séries</Text>

        {/*
          Lupa dentro do campo, à esquerda; limpar à direita.

          É o padrão que todo sistema operacional usa, e aqui ele carrega informação real: a lupa
          identifica o campo sem gastar uma linha de rótulo acima dele, e o "x" resolve o gesto mais
          frequente desta tela — recomeçar a busca —, que sem ele custa apagar letra por letra num
          teclado de celular.

          A borda vive no contêiner, não no TextInput: assim o foco destaca o campo inteiro, com
          lupa e botão dentro, em vez de uma caixa flutuando entre dois ícones soltos.
        */}
        <View
          style={[styles.campoCaixa, { backgroundColor: t.bgRaised, borderColor: t.borderStrong }]}
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
            style={[styles.campo, { color: t.fg }]}
          />

          {termo.length > 0 ? (
            <Pressable
              onPress={() => setTermo('')}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              // Alvo de toque próprio: o glifo tem 20px e o dedo precisa de 44.
              hitSlop={12}
            >
              <Ionicons name="close-circle" size={20} color={t.fgSubtle} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {curto ? (
        <View style={styles.aviso}>
          <Text style={[styles.avisoTitulo, { color: t.fg }]}>Digite para buscar</Text>
          <Text style={[styles.avisoTexto, { color: t.fgMuted }]}>
            Ao menos 2 caracteres. O que você adicionar entra na sua lista já com o catálogo de
            episódios.
          </Text>
        </View>
      ) : query.isPending ? (
        <View style={styles.aviso}>
          <ActivityIndicator color={t.accent} />
        </View>
      ) : query.isError ? (
        <View style={styles.aviso}>
          <Text style={[styles.avisoTitulo, { color: t.fg }]}>Não deu para buscar</Text>
          <Text style={[styles.avisoTexto, { color: t.fgMuted }]}>
            A busca precisa de rede e de uma chave do TMDB configurada no servidor.
          </Text>
          <Text style={[styles.detalhe, { color: t.fgSubtle }]}>{String(query.error)}</Text>
        </View>
      ) : query.data.length === 0 ? (
        <View style={styles.aviso}>
          <Text style={[styles.avisoTitulo, { color: t.fg }]}>Nenhuma série encontrada</Text>
          <Text style={[styles.avisoTexto, { color: t.fgMuted }]}>
            Tente o título original, ou em inglês.
          </Text>
        </View>
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(r) => String(r.tmdbId)}
          renderItem={({ item }) => <Hit result={item} />}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  cabecalho: { padding: Spacing[4], gap: Spacing[2] },
  titulo: { fontSize: FontSize.xl, fontWeight: '700' },
  campoCaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    minHeight: TouchTarget,
    paddingHorizontal: Spacing[3],
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  // `flex: 1` para o texto ocupar o meio e empurrar o botão de limpar para a borda direita.
  campo: { flex: 1, minHeight: TouchTarget, fontSize: FontSize.base },
  lista: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[6], gap: Spacing[2] },
  hit: {
    flexDirection: 'row',
    gap: Spacing[3],
    padding: Spacing[3],
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  // `overflow: hidden` porque a imagem entra por cima em posição absoluta: sem isto ela ignoraria
  // o raio da borda e apareceria como um retângulo de cantos vivos sobre a caixa arredondada.
  poster: {
    width: 56,
    aspectRatio: 2 / 3,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterInicial: { fontSize: FontSize.lg },
  // `flex: 1` + `minWidth: 0`: sem isso a sinopse longa empurra a coluna para fora da tela.
  texto: { flex: 1, minWidth: 0, gap: Spacing[1] },
  nome: { fontSize: FontSize.base, fontWeight: '700' },
  sinopse: { fontSize: FontSize.sm, lineHeight: 20 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: Spacing[1] },
  botao: {
    minHeight: TouchTarget,
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Radius.md,
  },
  botaoPrimario: { borderWidth: 0 },
  // Mesmo minHeight e mesmo raio do botão ao lado: os dois ocupam a mesma caixa.
  selo: {
    minHeight: TouchTarget,
    paddingHorizontal: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  seloTexto: { fontSize: FontSize.sm, fontWeight: '700' },
  erro: { fontSize: FontSize.sm },
  aviso: { padding: Spacing[6], gap: Spacing[2] },
  avisoTitulo: { fontSize: FontSize.lg, fontWeight: '700' },
  avisoTexto: { fontSize: FontSize.base, lineHeight: 22 },
  detalhe: { fontSize: FontSize.xs, fontFamily: 'monospace' },
});
