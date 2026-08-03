/**
 * Perfil — painel denso.
 *
 * <b>Grade de métricas.</b> Os mesmos números do editorial, mas em caixas de três colunas: cabe
 * tudo acima da dobra e a comparação entre eles é imediata. É a leitura de relance — "como está o
 * meu acervo hoje?" —, oposta à leitura sequencial que o editorial propõe.
 *
 * Perfil e estatísticas juntos porque no celular respondem à mesma curiosidade: "quanto disso é
 * meu?". Vêm de endpoints e chaves de cache diferentes, para a contagem de séries não esperar a
 * agregação do histórico inteiro.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import {
  formatPercent,
  formatRuntime,
  formatTotalTime,
  formatWatchedAt,
  formatWhen,
} from '@reprise/shared';
import type { Profile, StatsOverviewDto } from '@reprise/shared';
import { useCalendar, useProfile, useStatsOverview } from '@/api/queries';
import { BarChart } from '@/components/bar-chart';
import { CalendarHeatmap } from '@/components/calendar-heatmap';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useTokens } from '@/design/registry';
import { useSair } from '@/design/shared';

export default function PainelPerfil() {
  const t = useTokens();
  const status = useAutoSync();
  const profile = useProfile();
  const sair = useSair();

  /**
   * O filtro recorta SÓ os gráficos com eixo de tempo, nunca os totais.
   *
   * Marcação em massa é a que o TV Time gravou com a data do lote ao marcar temporadas inteiras: a
   * data é duvidosa, a exibição não. Somar não depende de quando aconteceu; desenhar no eixo
   * depende, e 9.995 exibições na mesma data virariam um pico que nunca houve.
   */
  const [comMassa, setComMassa] = useState(false);
  const stats = useStatsOverview(comMassa);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <SyncBar status={status} />
      <ScrollView
        contentContainerStyle={{ padding: t.shape.space(3), paddingBottom: t.shape.space(8), gap: t.shape.space(3) }}
      >
        <QueryState query={profile}>{(p) => <Identidade profile={p} />}</QueryState>

        <QueryState query={stats}>
          {(data) => <Metricas data={data} comMassa={comMassa} onComMassa={setComMassa} />}
        </QueryState>

        {/*
          Ajustes deixou de ser aba e passou a morar aqui, ACIMA de "Sair da conta": a lista desce
          da ação mais comum para a mais destrutiva, e sair é a única daqui que custa caro para
          desfazer — no celular, refazer o login exige digitar a senha inteira.
        */}
        <Pressable
          onPress={() => router.push('/ajustes')}
          accessibilityRole="button"
          accessibilityLabel="Ajustes"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.shape.space(2),
            minHeight: 48,
            paddingHorizontal: t.shape.space(2),
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: t.shape.radius.sm,
            backgroundColor: t.bgRaised,
          }}
        >
          <Ionicons name="options-outline" size={18} color={t.fgMuted} aria-hidden />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.fg, fontSize: t.shape.font.base, fontWeight: '600' }}>
              Ajustes
            </Text>
            <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={1}>
              Design, API, avisos, exportar, fila
            </Text>
          </View>
          {/* A seta diz que isto LEVA a algum lugar, em vez de fazer algo aqui mesmo. */}
          <Ionicons name="chevron-forward" size={16} color={t.fgSubtle} aria-hidden />
        </Pressable>

        <Pressable
          onPress={sair}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: t.shape.space(2),
            minHeight: 44,
            borderWidth: 1,
            borderColor: t.danger,
            borderRadius: t.shape.radius.sm,
          }}
        >
          {/* Ícone ACOMPANHANDO o rótulo, nunca no lugar dele: numa ação cara de desfazer, o texto
              é o que impede o toque por engano. */}
          <Ionicons name="log-out-outline" size={16} color={t.danger} aria-hidden />
          <Text style={{ color: t.danger, fontSize: t.shape.font.sm, fontWeight: '700' }}>
            Sair da conta
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Identidade({ profile }: { profile: Profile }) {
  const t = useTokens();
  const inicial = profile.displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.shape.space(2),
        padding: t.shape.space(2),
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: t.shape.radius.sm,
        backgroundColor: t.bgRaised,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: t.shape.radius.sm,
          backgroundColor: t.accentQuiet,
          borderWidth: 1,
          borderColor: t.accent,
        }}
      >
        <Text style={{ color: t.fg, fontSize: t.shape.font.lg, fontWeight: '700' }}>
          {inicial}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ color: t.fg, fontSize: t.shape.font.base, fontWeight: '700' }}
          numberOfLines={1}
        >
          {profile.displayName}
        </Text>
        <Text style={{ color: t.fgMuted, fontSize: t.shape.font.xs }} numberOfLines={1}>
          {profile.email}
        </Text>
        {/* "No Reprise desde há 3 dias": a preposição da frase colidia com a da resposta. */}
        <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={1}>
          Conta criada {formatWhen(profile.memberSince)}
          {profile.lastImportedAt ? ` · importado ${formatWhen(profile.lastImportedAt)}` : ''}
        </Text>
      </View>
    </View>
  );
}

function Metricas({
  data,
  comMassa,
  onComMassa,
}: {
  data: StatsOverviewDto;
  comMassa: boolean;
  onComMassa: (v: boolean) => void;
}) {
  const t = useTokens();
  const s = data.summary;
  const naLinhaDoTempo = data.byYear.reduce((soma, b) => soma + b.exhibitions, 0);

  return (
    <View style={{ gap: t.shape.space(3) }}>
      <Faixa titulo="No total" />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.shape.space(2) }}>
        <Caixa rotulo="Tempo assistido" valor={formatTotalTime(s.totalSeconds)} cor={t.accent} />
        <Caixa rotulo="Exibições" valor={s.exhibitions.toLocaleString('pt-BR')} />
        <Caixa
          rotulo="Episódios"
          valor={s.distinctEpisodes.toLocaleString('pt-BR')}
          nota="sem revisitas"
        />
        {/* "assistidas": conta as séries com pelo menos uma exibição, não as acompanhadas. São 115
            e 116 — o mesmo rótulo para os dois parece erro. */}
        <Caixa rotulo="Séries assistidas" valor={String(s.seriesCount)} />
        <Caixa rotulo="Rewatch" valor={formatPercent(s.rewatchRate)} nota="das exibições" />
      </View>

      {s.firstWatchedAt ? (
        <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }}>
          Do primeiro registro, {formatWatchedAt(s.firstWatchedAt)}, ao mais recente,{' '}
          {formatWatchedAt(s.lastWatchedAt)}.
        </Text>
      ) : null}

      <BarChart
        title="Séries por tempo assistido"
        bars={data.topSeries.map((x) => ({
          key: String(x.seriesId),
          label: x.name,
          value: x.seconds,
          detail: `${x.name}: ${formatRuntime(x.seconds)} · ${x.exhibitions} exibições em ${x.distinctEpisodes} episódios`,
        }))}
        format={(v) => formatTotalTime(v)}
      />

      {data.topSeries.length > 0 ? (
        <Pressable
          onPress={() => router.push(`/series/${data.topSeries[0]!.seriesId}`)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${data.topSeries[0]!.name}, a série que você mais assistiu`}
          style={{
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: t.borderStrong,
            borderRadius: t.shape.radius.sm,
          }}
        >
          <Text style={{ color: t.fg, fontSize: t.shape.font.sm, fontWeight: '700' }}>
            Abrir {data.topSeries[0]!.name}
          </Text>
        </Pressable>
      ) : null}

      <Faixa titulo="Ao longo do tempo" />

      {/* O aviso vem antes do interruptor porque explica por que ele existe. */}
      {s.backfillExhibitions > 0 ? (
        <View
          style={{
            padding: t.shape.space(2),
            borderRadius: t.shape.radius.sm,
            backgroundColor: t.accentQuiet,
          }}
        >
          <Text style={{ color: t.fg, fontSize: t.shape.font.xs, lineHeight: 17 }}>
            <Text style={{ fontWeight: '700' }}>
              {s.backfillExhibitions.toLocaleString('pt-BR')}
            </Text>{' '}
            das suas exibições vieram de marcação em massa e carregam a data do lote.{' '}
            <Text style={{ fontWeight: '700' }}>Contam nos totais acima</Text>, mas ficam fora dos
            gráficos: no eixo do tempo, elas diriam que você assistiu quase tudo num dia só.
          </Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: t.shape.space(2),
          minHeight: 44,
        }}
      >
        <Text style={{ color: t.fg, fontSize: t.shape.font.sm, flex: 1 }}>
          Mostrar as marcações em massa nos gráficos
        </Text>
        <Switch
          value={comMassa}
          onValueChange={onComMassa}
          accessibilityLabel="Mostrar as marcações em massa nos gráficos de tempo"
        />
      </View>

      {naLinhaDoTempo === 0 ? (
        <Text style={{ color: t.fgMuted, fontSize: t.shape.font.xs, lineHeight: 18 }}>
          Nenhuma exibição com data confiável ainda. Conforme você for marcando episódios pelo
          Reprise, os gráficos se preenchem sozinhos.
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.shape.space(2) }}>
            <Caixa
              rotulo="Exibições datadas"
              valor={naLinhaDoTempo.toLocaleString('pt-BR')}
              nota="entram nos gráficos"
            />
            <Caixa
              rotulo="Maior sequência"
              valor={`${data.streaks.longestDays} d`}
              nota={
                data.streaks.currentDays > 0
                  ? `atual: ${data.streaks.currentDays} d`
                  : 'sem sequência'
              }
            />
          </View>

          <BarChart
            title="Tempo assistido por ano"
            bars={data.byYear.map((b) => ({
              key: b.label,
              label: b.label,
              value: b.seconds,
              detail: `${b.label}: ${formatRuntime(b.seconds)} em ${b.exhibitions} exibições`,
            }))}
            format={(v) => formatTotalTime(v)}
          />

          <Calendario
            ano={data.availableYears[0] ?? new Date().getFullYear()}
            comMassa={comMassa}
          />
        </>
      )}
    </View>
  );
}

/** O calendário vem de outro endpoint; carregar à parte evita segurar os números do topo. */
function Calendario({ ano, comMassa }: { ano: number; comMassa: boolean }) {
  const query = useCalendar(ano, comMassa);
  if (!query.data) return null;
  return <CalendarHeatmap year={ano} days={query.data} />;
}

function Faixa({ titulo }: { titulo: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        paddingHorizontal: t.shape.space(2),
        paddingVertical: t.shape.space(1),
        backgroundColor: t.bgSunken,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: t.shape.radius.sm,
      }}
    >
      <Text style={[t.shape.section, { color: t.fgMuted }]}>{titulo}</Text>
    </View>
  );
}

function Caixa({
  rotulo,
  valor,
  nota,
  cor,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  cor?: string;
}) {
  const t = useTokens();
  return (
    <View
      style={{
        flexGrow: 1,
        // Três colunas em telefone; `flexGrow` deixa a última linha ocupar o resto em vez de
        // deixar um buraco à direita.
        flexBasis: '30%',
        minWidth: 96,
        padding: t.shape.space(2),
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: t.shape.radius.sm,
        backgroundColor: t.bgRaised,
      }}
    >
      <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={1}>
        {rotulo}
      </Text>
      <Text
        style={{
          color: cor ?? t.fg,
          fontSize: t.shape.font.lg,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}
      >
        {valor}
      </Text>
      {nota ? (
        <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={1}>
          {nota}
        </Text>
      ) : null}
    </View>
  );
}
