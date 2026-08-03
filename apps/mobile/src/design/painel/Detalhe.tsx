/**
 * Detalhe — painel denso.
 *
 * <b>Os números primeiro.</b> Uma faixa de métricas abre a tela — assistidos, faltam, temporadas,
 * porcentagem — antes de qualquer imagem. A capa fica pequena ao lado do nome porque nesta tela
 * ela não decide nada: quem chega aqui já sabe qual série abriu.
 *
 * <b>Todas as temporadas fechadas, menos uma.</b> A tabela mostra a linha de cada temporada com
 * seus números; abrir é opcional. Com 12 temporadas isso cabe numa tela sem rolagem, e a
 * comparação entre elas — qual está pela metade — fica possível, coisa que nenhum dos outros dois
 * designs oferece. A do próximo episódio abre sozinha, que é a pergunta com que se entra aqui.
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
import { Poster, Progresso } from '@/design/primitives';
import { useTokens } from '@/design/registry';
import { ContagemDaTemporada, useDetalhe } from '@/design/shared';

export default function PainelDetalhe() {
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
            <Stack.Screen options={{ title: series.name, headerTransparent: false }} />
            <Corpo series={series} />
          </>
        )}
      </QueryState>
    </View>
  );
}

function Corpo({ series }: { series: SeriesDetail }) {
  const t = useTokens();
  const d = useDetalhe(series);
  const markUpTo = useMarkUpTo(series.id);

  const faltam = Math.max(0, series.episodesAired - d.assistidos);
  const regulares = series.seasons.filter((s) => !s.isSpecials).length;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: t.shape.space(8) }}>
      <View
        style={{
          flexDirection: 'row',
          gap: t.shape.space(2),
          padding: t.shape.space(3),
          alignItems: 'center',
        }}
      >
        <Poster
          path={series.posterPath}
          nome={series.name}
          largura={48}
          aspect={2 / 3}
          chave={String(series.id)}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: t.fg, fontSize: t.shape.font.lg, fontWeight: '700' }}>
            {series.name}
          </Text>
          {series.originalName && series.originalName !== series.name ? (
            <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={1}>
              {series.originalName}
            </Text>
          ) : null}
          <Text style={{ color: t.fgMuted, fontSize: t.shape.font.xs }} numberOfLines={2}>
            {d.completion.label}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: t.shape.space(2),
          paddingHorizontal: t.shape.space(3),
        }}
      >
        <Metrica rotulo="Assistidos" valor={String(d.assistidos)} cor={t.state.progress} />
        <Metrica
          rotulo="Faltam"
          valor={String(faltam)}
          cor={faltam === 0 ? t.state.upToDate : undefined}
        />
        <Metrica rotulo="Temporadas" valor={String(regulares)} />
        <Metrica rotulo="Concluído" valor={formatPercent(d.ratio)} />
      </View>

      <View style={{ paddingHorizontal: t.shape.space(3), paddingTop: t.shape.space(2) }}>
        <Progresso
          ratio={d.ratio}
          altura={4}
          cor={d.completion.isFinished ? t.state.finished : t.state.progress}
        />
      </View>

      {series.overview ? (
        <Text
          style={{
            color: t.fgMuted,
            fontSize: t.shape.font.xs,
            lineHeight: 18,
            paddingHorizontal: t.shape.space(3),
            paddingTop: t.shape.space(2),
          }}
          numberOfLines={4}
        >
          {series.overview}
        </Text>
      ) : null}

      <Estado seriesId={series.id} atual={series.status} />

      {/* Antes das temporadas: "quantas vezes eu percorri isto" vem antes de "onde eu estou nesta
          passada". Mesma ordem do web. */}
      <View style={{ paddingHorizontal: t.shape.space(3) }}>
        <RewatchSessions
          sessions={series.sessions}
          backfillExhibitions={series.backfillExhibitions}
        />
      </View>

      <Cabecalho />

      {series.seasons.map((s) => (
        <LinhaDaTemporada
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

function Metrica({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        flex: 1,
        padding: t.shape.space(2),
        backgroundColor: t.bgRaised,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: t.shape.radius.sm,
      }}
    >
      <Text
        style={{
          color: cor ?? t.fg,
          fontSize: t.shape.font.lg,
          fontWeight: '700',
          // Tabular para os números não dançarem de largura entre atualizações.
          fontVariant: ['tabular-nums'],
        }}
      >
        {valor}
      </Text>
      <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={1}>
        {rotulo}
      </Text>
    </View>
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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.shape.space(2),
        paddingHorizontal: t.shape.space(3),
        paddingTop: t.shape.space(3),
      }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Estado"
    >
      <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs, width: 48 }}>Estado</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.shape.space(1), flex: 1 }}>
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
                {formatSeriesStatus(s)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** O cabeçalho da tabela de temporadas. Nomeia as colunas que as linhas repetem. */
function Cabecalho() {
  const t = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: t.shape.space(3),
        paddingVertical: t.shape.space(1),
        marginTop: t.shape.space(3),
        backgroundColor: t.bgSunken,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: t.border,
      }}
    >
      <Text style={[t.shape.section, { color: t.fgMuted }]}>Temporada</Text>
      <Text style={[t.shape.section, { color: t.fgSubtle }]}>Vistos · Faltam</Text>
    </View>
  );
}

function LinhaDaTemporada({
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
          gap: t.shape.space(2),
          paddingHorizontal: t.shape.space(3),
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
            alignItems: 'center',
            gap: t.shape.space(2),
            minHeight: 44,
          }}
        >
          {/* Seta em texto: o estado aberto/fechado não depende só da rotação de um ícone. */}
          <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.sm, width: 12 }}>
            {aberta ? '▾' : '▸'}
          </Text>
          <Text
            style={{ color: t.fg, fontSize: t.shape.font.sm, fontWeight: '600', flex: 1 }}
            numberOfLines={1}
          >
            {c.nome}
          </Text>

          {/* Barra curta em vez de percentual escrito: a coluna já tem dois números, e um terceiro
              faria a linha virar planilha. */}
          <View style={{ width: 48 }}>
            <Progresso
              ratio={c.total > 0 ? c.assistidos / c.total : 0}
              altura={3}
              cor={c.completa ? t.state.finished : t.state.progress}
            />
          </View>

          <Text
            style={{
              color: t.fgMuted,
              fontSize: t.shape.font.xs,
              fontVariant: ['tabular-nums'],
              width: 68,
              textAlign: 'right',
            }}
          >
            {c.assistidos}/{c.total}
            {c.porAssistir > 0 ? ` · ${c.porAssistir}` : c.resumo}
          </Text>
        </Pressable>

        {c.porAssistir > 0 ? (
          <Pressable
            onPress={() => markSeason.mutate(season.seasonNumber)}
            disabled={markSeason.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Marcar os ${c.porAssistir} episódios não vistos de ${c.nome}`}
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: markSeason.isPending ? 0.5 : 1,
            }}
          >
            <Text style={{ color: t.accent, fontSize: t.shape.font.sm, fontWeight: '700' }}>
              ✓{c.porAssistir}
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
