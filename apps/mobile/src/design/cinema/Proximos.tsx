/**
 * Próximos — cinematográfico.
 *
 * <b>Um herói e trilhos.</b> A série mais recente ocupa a tela inteira em capa sangrada, com o
 * texto por cima da própria imagem; o resto vira trilho horizontal de capas, como prateleira de
 * serviço de streaming. A aposta deste design é que você reconhece pela imagem antes de ler, então
 * a imagem ganha o espaço e o texto some para o rodapé do herói.
 *
 * <b>O degradê não é enfeite.</b> Texto branco sobre capa é ilegível na metade das imagens — capa
 * clara existe. A faixa escura ao pé do herói é o que garante contraste sem escurecer a arte
 * inteira, e é por isso que ela é sólida embaixo e transparente em cima.
 */
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Airing, HomeShelf, formatEpisodeCode, posterUrl } from '@reprise/shared';
import type { NextUpItem } from '@reprise/shared';
import { useNextUp, usePremieres, useProfile } from '@/api/queries';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { Aviso, MarcarVisto, Poster } from '@/design/primitives';
import { useTokens } from '@/design/registry';

export default function CinemaProximos() {
  const t = useTokens();
  const status = useAutoSync();
  const query = useNextUp();
  const premieres = usePremieres();
  const profile = useProfile();
  const { width } = useWindowDimensions();

  const [pausaAberto, setPausaAberto] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {(items) => {
          const { emAndamento, emPausa } = HomeShelf.split(items);
          const fila = emAndamento.length > 0 ? emAndamento : emPausa;
          const [heroi, ...resto] = fila;
          const nome = profile.data?.displayName?.trim().split(/\s+/)[0];
          const estreias = HomeShelf.upcomingPremieres(premieres.data ?? []);

          if (!heroi) {
            return (
              <Aviso
                titulo="Nada em aberto"
                texto="Toda série que você acompanha está em dia."
              />
            );
          }

          return (
            <ScrollView
              contentContainerStyle={{ paddingBottom: t.shape.space(8) }}
              showsVerticalScrollIndicator={false}
            >
              <Heroi item={heroi} largura={width} saudacao={`${HomeShelf.greeting()}${nome ? `, ${nome}` : ''}`} />

              {resto.length > 0 ? (
                <Trilho
                  titulo={emAndamento.length > 0 ? 'Continuar assistindo' : 'Retomar'}
                  itens={resto}
                />
              ) : null}

              {estreias.length > 0 ? (
                <View style={{ paddingHorizontal: t.shape.space(4), gap: t.shape.space(2), marginTop: t.shape.space(5) }}>
                  <Text style={[t.shape.section, { color: t.fg }]}>Estreias</Text>
                  {/* Uma por série, e só com data e resumo — a regra é do HomeShelf. A data sai do
                      Airing, que ancora a air_date no meio-dia UTC: lida crua, ela vira meia-noite
                      UTC e, no Brasil, a véspera. */}
                  {estreias.slice(0, 4).map((p) => (
                    <View key={p.episodeId} style={{ gap: 2 }}>
                      <Text style={{ color: t.fgMuted, fontSize: t.shape.font.sm }}>
                        {p.seriesName} · {formatEpisodeCode(p.seasonNumber, p.episodeNumber)} ·{' '}
                        {Airing.label(p.airDate, undefined, p.releasesAt)}
                      </Text>
                      {p.overview ? (
                        <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={3}>
                          {p.overview}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {emAndamento.length > 0 && emPausa.length > 0 ? (
                <View style={{ marginTop: t.shape.space(5) }}>
                  <Pressable
                    onPress={() => setPausaAberto((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: pausaAberto }}
                    accessibilityLabel={`Em pausa, ${emPausa.length} séries`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: t.shape.space(4),
                      minHeight: 48,
                    }}
                  >
                    <Text style={[t.shape.section, { color: t.fg }]}>
                      Em pausa · {emPausa.length}
                    </Text>
                    <Ionicons
                      name={pausaAberto ? 'chevron-down' : 'chevron-forward'}
                      size={18}
                      color={t.fgSubtle}
                      aria-hidden
                    />
                  </Pressable>
                  {pausaAberto ? <Trilho titulo={null} itens={emPausa} /> : null}
                </View>
              ) : null}
            </ScrollView>
          );
        }}
      </QueryState>
    </SafeAreaView>
  );
}

/** A capa em tela cheia, com o texto deitado sobre o próprio pé da imagem. */
function Heroi({
  item,
  largura,
  saudacao,
}: {
  item: NextUpItem;
  largura: number;
  saudacao: string;
}) {
  const t = useTokens();
  const capa = posterUrl(item.posterPath, 'w342');
  const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);
  const altura = Math.round(largura * 1.25);

  return (
    <View style={{ width: largura, height: altura }}>
      {capa ? (
        <Image
          source={{ uri: capa }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bgSunken }]} />
      )}

      {/*
        Três faixas em vez de um degradê de verdade: `expo-linear-gradient` seria uma dependência
        nova só para isto. Empilhadas com opacidade crescente, a transição fica suave o bastante
        no tamanho em que aparece, e o texto ganha o contraste de que precisa.
      */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: altura * 0.55 }}>
        <View style={{ flex: 1, backgroundColor: t.bg, opacity: 0.15 }} />
        <View style={{ flex: 1, backgroundColor: t.bg, opacity: 0.45 }} />
        <View style={{ flex: 1, backgroundColor: t.bg, opacity: 0.8 }} />
        <View style={{ flex: 1, backgroundColor: t.bg, opacity: 0.96 }} />
      </View>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: t.shape.space(4),
          gap: t.shape.space(2),
        }}
      >
        <Text style={[t.shape.eyebrow, { color: t.accent }]}>{saudacao}</Text>

        <Pressable
          onPress={() => router.push(`/series/${item.seriesId}`)}
          accessibilityRole="button"
          accessibilityLabel={item.seriesName}
        >
          <Text style={[t.shape.title, { color: t.fg }]} numberOfLines={2}>
            {item.seriesName}
          </Text>
        </Pressable>

        <Text style={{ color: t.fgMuted, fontSize: t.shape.font.base }} numberOfLines={2}>
          {code}
          {item.episode.name ? ` · ${item.episode.name}` : ''}
        </Text>

        <View style={{ marginTop: t.shape.space(2) }}>
          <MarcarVisto item={item} />
        </View>
      </View>
    </View>
  );
}

/** Prateleira horizontal de capas. Sem nome sob a capa: a arte é o rótulo neste design. */
function Trilho({ titulo, itens }: { titulo: string | null; itens: readonly NextUpItem[] }) {
  const t = useTokens();

  return (
    <View style={{ marginTop: t.shape.space(5), gap: t.shape.space(3) }}>
      {titulo ? (
        <Text style={[t.shape.section, { color: t.fg, paddingHorizontal: t.shape.space(4) }]}>
          {titulo}
        </Text>
      ) : null}

      <FlatList
        horizontal
        data={itens as NextUpItem[]}
        keyExtractor={(i) => String(i.seriesId)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: t.shape.space(2), paddingHorizontal: t.shape.space(4) }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/series/${item.seriesId}`)}
            accessibilityRole="button"
            accessibilityLabel={`${item.seriesName}, ${formatEpisodeCode(
              item.episode.seasonNumber,
              item.episode.episodeNumber,
            )}`}
            style={{ gap: t.shape.space(1) }}
          >
            <Poster
              path={item.posterPath}
              nome={item.seriesName}
              largura={110}
              chave={String(item.seriesId)}
            />
            <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs, width: 110 }} numberOfLines={1}>
              {formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
