/**
 * Detalhe — editorial.
 *
 * <b>Matéria, com ficha técnica.</b> Manchete grande, olho em corpo maior e uma ficha de pares
 * rótulo/valor separados por fio — estado, progresso, temporadas, episódios. Onde o painel põe
 * caixas de métrica e o cinematográfico põe a capa por cima de tudo, aqui a informação é lida como
 * texto corrido, e a capa é uma miniatura ao lado do título.
 *
 * <b>Temporadas em sanfona, uma aberta.</b> Séries longas — Two and a Half Men tem 262 episódios
 * em 12 temporadas — viravam rolagem infinita em que achar onde você parou custava mais do que
 * marcar. Abre sozinha a temporada do próximo episódio, que é a pergunta com que se entra aqui.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SERIES_STATUSES, formatPercent, formatSeriesStatus } from '@reprise/shared';
import type { Episode, Season, SeriesDetail } from '@reprise/shared';
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
import { Poster } from '@/design/primitives';
import { useTokens } from '@/design/registry';
import { ContagemDaTemporada, useDetalhe } from '@/design/shared';

export default function EditorialDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTokens();
  const status = useAutoSync();
  const query = useSeriesDetail(Number(id));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <SyncBar status={status} />
      <QueryState query={query}>
        {(series) => (
          <>
            {/* O título vai para o cabeçalho de navegação também: rolando a matéria, a manchete
                some e a seta de voltar fica sem contexto. */}
            <Stack.Screen options={{ title: series.name, headerTransparent: false }} />
            <Materia series={series} />
          </>
        )}
      </QueryState>
    </View>
  );
}

function Materia({ series }: { series: SeriesDetail }) {
  const t = useTokens();
  const d = useDetalhe(series);
  const markUpTo = useMarkUpTo(series.id);

  const regulares = series.seasons.filter((s) => !s.isSpecials).length;

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: t.shape.space(4),
        paddingBottom: t.shape.space(8),
      }}
    >
      <View style={{ paddingTop: t.shape.space(4), gap: t.shape.space(3) }}>
        <Text style={[t.shape.eyebrow, { color: t.accent }]}>Série</Text>

        <View style={{ flexDirection: 'row', gap: t.shape.space(3), alignItems: 'flex-start' }}>
          <View style={{ flex: 1, minWidth: 0, gap: t.shape.space(1) }}>
            <Text
              style={{
                color: t.fg,
                fontSize: t.shape.font.xl,
                fontWeight: '700',
                letterSpacing: -0.8,
                lineHeight: t.shape.font.xl * 1.15,
              }}
            >
              {series.name}
            </Text>
            {series.originalName && series.originalName !== series.name ? (
              <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.sm }}>
                {series.originalName}
              </Text>
            ) : null}
          </View>

          <Poster path={series.posterPath} nome={series.name} largura={72} />
        </View>

        {series.overview ? (
          <Text
            style={{
              color: t.fgMuted,
              fontSize: t.shape.font.base,
              lineHeight: t.shape.font.base * 1.6,
            }}
          >
            {series.overview}
          </Text>
        ) : null}
      </View>

      {/* A ficha: pares rótulo/valor. Um bloco de números seria mais compacto e diria menos — aqui
          cada linha carrega o nome do que está medindo. */}
      <View style={{ marginTop: t.shape.space(5) }}>
        <Ficha rotulo="Estado" valor={formatSeriesStatus(series.status)} />
        <Ficha
          rotulo="Progresso"
          valor={`${d.assistidos}/${d.total} · ${formatPercent(d.ratio)}`}
        />
        <Ficha
          rotulo="Temporadas"
          valor={`${regulares}${series.seasons.length > regulares ? ' + especiais' : ''}`}
        />
        <Ficha rotulo="Situação" valor={d.completion.label} />
      </View>

      <Estado seriesId={series.id} atual={series.status} />

      {/* Antes das temporadas: "quantas vezes eu percorri isto" vem antes de "onde eu estou nesta
          passada". Mesma ordem do web. */}
      <RewatchSessions
        sessions={series.sessions}
        backfillExhibitions={series.backfillExhibitions}
      />

      <Text
        style={[
          t.shape.section,
          {
            color: t.fg,
            marginTop: t.shape.space(5),
            paddingBottom: t.shape.space(2),
            borderBottomWidth: 2,
            borderBottomColor: t.fg,
          },
        ]}
      >
        Temporadas
      </Text>

      {series.seasons.map((s) => (
        <Bloco
          key={s.seasonNumber}
          season={s}
          seriesId={series.id}
          contar={d.contar}
          pico={d.pico}
          abertaDeInicio={s.seasonNumber === d.temporadaInicial}
          onMarcarAte={(e) =>
            markUpTo.mutate({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })
          }
        />
      ))}
    </ScrollView>
  );
}

/** Uma linha da ficha: rótulo à esquerda, valor à direita, fio embaixo. */
function Ficha({ rotulo, valor }: { rotulo: string; valor: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: t.shape.space(3),
        paddingVertical: t.shape.space(2),
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      <Text style={[t.shape.section, { color: t.fgSubtle }]}>{rotulo}</Text>
      <Text
        style={{
          color: t.fg,
          fontSize: t.shape.font.base,
          fontWeight: '600',
          flexShrink: 1,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}
      >
        {valor}
      </Text>
    </View>
  );
}

/**
 * Estado de acompanhamento — a decisão sobre a série inteira, e o que tira uma série de "Próximos"
 * sem apagar um único evento do histórico.
 *
 * Sem pílulas: os estados são links de texto, e o ativo ganha peso e sublinhado. Uma fileira de
 * caixas coloridas seria o elemento mais chamativo de uma tela que hierarquiza por tipografia.
 */
function Estado({ seriesId, atual }: { seriesId: number; atual: string }) {
  const t = useTokens();
  const setStatus = useSetSeriesStatus();

  return (
    <View style={{ marginTop: t.shape.space(4), gap: t.shape.space(2) }}>
      <Text style={[t.shape.section, { color: t.fgSubtle }]}>Mudar estado</Text>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.shape.space(4) }}
        accessibilityRole="radiogroup"
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
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
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
                {formatSeriesStatus(s)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Bloco({
  season,
  seriesId,
  contar,
  pico,
  abertaDeInicio,
  onMarcarAte,
}: {
  season: Season;
  seriesId: number;
  contar: (e: Episode) => number;
  pico: number;
  abertaDeInicio: boolean;
  onMarcarAte: (e: Episode) => void;
}) {
  const t = useTokens();
  const [aberta, setAberta] = useState(abertaDeInicio);
  const markSeason = useMarkSeason(seriesId);
  const c = ContagemDaTemporada.of(season, contar);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.shape.space(3),
          borderBottomWidth: 1,
          borderBottomColor: t.border,
        }}
      >
        <Pressable
          onPress={() => setAberta((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: aberta }}
          accessibilityLabel={`${c.nome}, ${c.assistidos} de ${c.total} assistidos. ${aberta ? 'Recolher' : 'Expandir'}.`}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: t.shape.space(2),
            minHeight: 52,
            paddingVertical: t.shape.space(2),
          }}
        >
          {/* Sinal em texto: o estado aberto/fechado não depende da rotação de um ícone. */}
          <Text style={{ color: t.accent, fontSize: t.shape.font.base, width: 14 }}>
            {aberta ? '—' : '+'}
          </Text>
          <Text style={{ color: t.fg, fontSize: t.shape.font.base, fontWeight: '700', flex: 1 }}>
            {c.nome}
          </Text>
          {/* O progresso no cabeçalho para ser legível com a temporada fechada. */}
          <Text
            style={{
              color: t.fgSubtle,
              fontSize: t.shape.font.sm,
              fontVariant: ['tabular-nums'],
            }}
          >
            {c.assistidos}/{c.total}
            {c.resumo}
          </Text>
        </Pressable>

        {c.porAssistir > 0 ? (
          <Pressable
            onPress={() => markSeason.mutate(season.seasonNumber)}
            disabled={markSeason.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Marcar os ${c.porAssistir} episódios não vistos de ${c.nome}`}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Text
              style={{
                color: t.accent,
                fontSize: t.shape.font.sm,
                fontWeight: '700',
                opacity: markSeason.isPending ? 0.5 : 1,
              }}
            >
              Marcar {c.porAssistir}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {aberta
        ? season.episodes.map((e) => (
            <Linha
              key={e.id}
              episode={e}
              count={contar(e)}
              pico={pico}
              onMarcarAte={() => onMarcarAte(e)}
            />
          ))
        : null}
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
