/**
 * Detalhe — cinematográfico.
 *
 * <b>Cartaz de entrada.</b> A capa ocupa a largura toda, o cabeçalho de navegação flutua por cima
 * dela e o nome da série assenta sobre a imagem, sob um degradê. É a única tela do app em que o
 * título não é texto num fundo: ele faz parte do cartaz.
 *
 * <b>Uma temporada de cada vez, escolhida numa fita.</b> Os outros designs empilham temporadas em
 * sanfonas; aqui elas viram uma régua horizontal de números e só a escolhida aparece. A troca sai
 * de "abrir e fechar blocos e depois achar onde eu estava" para "tocar o número" — que é como se
 * navega uma série longa quando o que você quer é UM episódio, não o inventário. Two and a Half
 * Men tem 262 episódios em 12 temporadas; a sanfona os transformava em rolagem infinita.
 *
 * A régua abre sozinha na temporada do próximo episódio, que é a pergunta com que se entra aqui.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SERIES_STATUSES, formatPercent, formatSeriesStatus, posterUrl } from '@reprise/shared';
import type { Episode, SeriesDetail } from '@reprise/shared';
import {
  useMarkEpisode,
  useMarkSeason,
  useMarkUpTo,
  useSeriesDetail,
  useSetSeriesStatus,
  useUnmarkEpisode,
} from '@/api/queries';
import { EpisodeRow } from '@/components/episode-row';
import { QueryState } from '@/components/query-state';
import { RewatchSessions } from '@/components/rewatch-sessions';
import { SyncBar } from '@/components/sync-bar';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { Botao, Progresso, Scrim } from '@/design/primitives';
import { useTokens } from '@/design/registry';
import { ContagemDaTemporada, useDetalhe } from '@/design/shared';

export default function CinemaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTokens();
  const status = useAutoSync();
  const query = useSeriesDetail(Number(id));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Cabeçalho transparente: a capa começa atrás dele, não abaixo. O título fica vazio porque
          ele já está desenhado sobre a imagem — repetido no topo, seria a mesma palavra duas vezes. */}
      <Stack.Screen options={{ title: '', headerTransparent: true }} />
      <SyncBar status={status} />
      <QueryState query={query}>{(series) => <Corpo series={series} />}</QueryState>
    </View>
  );
}

function Corpo({ series }: { series: SeriesDetail }) {
  const t = useTokens();
  const { width } = useWindowDimensions();
  const d = useDetalhe(series);
  const markUpTo = useMarkUpTo(series.id);

  const [temporada, setTemporada] = useState<number | undefined>(d.temporadaInicial);
  const atual =
    series.seasons.find((s) => s.seasonNumber === temporada) ?? series.seasons[0] ?? null;

  // `w500` é o maior que o cliente compartilhado oferece, e aqui a capa ocupa a largura da tela:
  // em `w342` ela subiria esticada num aparelho moderno.
  const capa = posterUrl(series.posterPath, 'w500');

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: t.shape.space(8) }}>
      <View style={{ width, height: width * 1.1 }}>
        {capa ? (
          <Image
            source={{ uri: capa }}
            style={{ width, height: width * 1.1 }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: t.bgSunken }} />
        )}

        <Scrim cor={t.bg} />

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
          <Text style={[t.shape.title, { color: '#ffffff' }]}>{series.name}</Text>

          {series.originalName && series.originalName !== series.name ? (
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: t.shape.font.sm }}>
              {series.originalName}
            </Text>
          ) : null}

          {/* Texto branco fixo, e não `t.fg`: no tema claro o degradê continua escurecendo a
              imagem, então aqui o fundo é a foto, não a cor de fundo do app. */}
          <Text style={[t.shape.section, { color: 'rgba(255,255,255,0.85)' }]}>
            {formatSeriesStatus(series.status)} · {d.assistidos}/{d.total} ·{' '}
            {formatPercent(d.ratio)}
          </Text>

          <Progresso
            ratio={d.ratio}
            altura={3}
            cor={d.completion.isFinished ? t.state.finished : t.accent}
          />

          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: t.shape.font.xs }}>
            {d.completion.label}
          </Text>
        </View>
      </View>

      {series.overview ? (
        <Text
          style={{
            color: t.fgMuted,
            fontSize: t.shape.font.sm,
            lineHeight: 21,
            paddingHorizontal: t.shape.space(4),
            paddingTop: t.shape.space(3),
          }}
        >
          {series.overview}
        </Text>
      ) : null}

      <Estado seriesId={series.id} atual={series.status} />

      {/* Antes das temporadas: "quantas vezes eu percorri isto" vem antes de "onde eu estou nesta
          passada". Mesma ordem do web. */}
      <View style={{ paddingHorizontal: t.shape.space(4) }}>
        <RewatchSessions
          sessions={series.sessions}
          backfillExhibitions={series.backfillExhibitions}
        />
      </View>

      <Regua
        series={series}
        contar={d.contar}
        escolhida={atual?.seasonNumber}
        onEscolher={setTemporada}
      />

      {atual ? (
        <Episodios
          series={series}
          season={atual}
          contar={d.contar}
          pico={d.pico}
          onMarcarAte={(e) =>
            markUpTo.mutate({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })
          }
        />
      ) : null}
    </ScrollView>
  );
}

/**
 * Estado de acompanhamento — a decisão sobre a série inteira, e o que tira uma série de "Próximos"
 * sem apagar um único evento do histórico.
 */
function Estado({ seriesId, atual }: { seriesId: number; atual: string }) {
  const t = useTokens();
  const setStatus = useSetSeriesStatus();

  return (
    <View style={{ paddingTop: t.shape.space(4), gap: t.shape.space(2) }}>
      <Text
        style={[t.shape.section, { color: t.fgSubtle, paddingHorizontal: t.shape.space(4) }]}
      >
        Estado
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: t.shape.space(4),
          gap: t.shape.space(2),
        }}
      >
        {SERIES_STATUSES.map((s) => {
          const ativo = s === atual;
          return (
            <Pressable
              key={s}
              onPress={() => setStatus.mutate({ seriesId, status: s })}
              disabled={ativo || setStatus.isPending}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={`Marcar como ${formatSeriesStatus(s)}`}
              style={{
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: t.shape.space(4),
                backgroundColor: ativo ? t.accent : 'transparent',
                borderWidth: 1,
                borderColor: ativo ? t.accent : t.border,
              }}
            >
              <Text
                style={{
                  color: ativo ? t.accentFg : t.fgMuted,
                  fontSize: t.shape.font.sm,
                  fontWeight: ativo ? '800' : '500',
                }}
              >
                {formatSeriesStatus(s)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** A régua de temporadas. Número grande, progresso embaixo, a escolhida sublinhada em âmbar. */
function Regua({
  series,
  contar,
  escolhida,
  onEscolher,
}: {
  series: SeriesDetail;
  contar: (e: Episode) => number;
  escolhida: number | undefined;
  onEscolher: (n: number) => void;
}) {
  const t = useTokens();

  return (
    <View style={{ paddingTop: t.shape.space(5), gap: t.shape.space(2) }}>
      <Text
        style={[t.shape.section, { color: t.fgSubtle, paddingHorizontal: t.shape.space(4) }]}
      >
        Temporadas
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.shape.space(4), gap: t.shape.space(3) }}
        accessibilityRole="radiogroup"
      >
        {series.seasons.map((s) => {
          const c = ContagemDaTemporada.of(s, contar);
          const ativo = s.seasonNumber === escolhida;
          return (
            <Pressable
              key={s.seasonNumber}
              onPress={() => onEscolher(s.seasonNumber)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={`${c.nome}, ${c.assistidos} de ${c.total} assistidos`}
              style={{ minWidth: 56, minHeight: 64, gap: t.shape.space(1) }}
            >
              {/* Número grande + peso + sublinhado: "onde estou" nunca depende só do tom. */}
              <Text
                style={{
                  color: ativo ? t.accent : t.fgMuted,
                  fontSize: t.shape.font.xl,
                  fontWeight: ativo ? '800' : '500',
                  fontVariant: ['tabular-nums'],
                  textAlign: 'center',
                }}
              >
                {s.isSpecials ? '★' : s.seasonNumber}
              </Text>
              <Text
                style={{
                  color: ativo ? t.fg : t.fgSubtle,
                  fontSize: t.shape.font.xs,
                  textAlign: 'center',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {c.assistidos}/{c.total}
              </Text>
              <View
                style={{
                  height: 2,
                  backgroundColor: ativo ? t.accent : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Episodios({
  series,
  season,
  contar,
  pico,
  onMarcarAte,
}: {
  series: SeriesDetail;
  season: SeriesDetail['seasons'][number];
  contar: (e: Episode) => number;
  pico: number;
  onMarcarAte: (e: Episode) => void;
}) {
  const t = useTokens();
  const markSeason = useMarkSeason(series.id);
  const c = ContagemDaTemporada.of(season, contar);

  return (
    <View style={{ marginTop: t.shape.space(4) }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: t.shape.space(3),
          paddingHorizontal: t.shape.space(4),
          paddingBottom: t.shape.space(2),
          borderBottomWidth: 1,
          borderBottomColor: t.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.fg, fontSize: t.shape.font.lg, fontWeight: '700' }}>
            {c.nome}
          </Text>
          <Text
            style={{
              color: t.fgSubtle,
              fontSize: t.shape.font.xs,
              fontVariant: ['tabular-nums'],
            }}
          >
            {c.assistidos}/{c.total}
            {c.resumo}
          </Text>
        </View>

        {c.porAssistir > 0 ? (
          <Botao
            titulo={`Marcar ${c.porAssistir}`}
            variante="contorno"
            ocupado={markSeason.isPending}
            onPress={() => markSeason.mutate(season.seasonNumber)}
          />
        ) : null}
      </View>

      {season.episodes.map((e) => (
        <Linha
          key={e.id}
          episode={e}
          count={contar(e)}
          pico={pico}
          onMarcarAte={() => onMarcarAte(e)}
        />
      ))}
    </View>
  );
}

/** Liga a linha às mutações. Existe para os hooks ficarem por episódio, não por temporada. */
function Linha({
  episode,
  count,
  pico,
  onMarcarAte,
}: {
  episode: Episode;
  count: number;
  pico: number;
  onMarcarAte: () => void;
}) {
  const mark = useMarkEpisode();
  const unmark = useUnmarkEpisode();

  return (
    <EpisodeRow
      episode={episode}
      count={count}
      peak={pico}
      onMark={() => mark.mutate(episode.id)}
      onUnmark={() => unmark.mutate(episode.id)}
      onMarkUpTo={onMarcarAte}
    />
  );
}
