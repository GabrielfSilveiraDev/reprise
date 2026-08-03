/**
 * Próximos — painel denso.
 *
 * <b>Ferramenta, não vitrine.</b> Uma faixa de números no topo responde "quanto falta?" antes de
 * qualquer lista, e cada série ocupa uma linha só: nome, código do episódio, progresso em número e
 * em barra, e o botão de marcar como ícone no fim. Sem capa — imagem aqui custaria a altura de
 * três linhas de dado.
 *
 * <b>Sem prateleira colapsável.</b> "Em andamento" e "em pausa" convivem na mesma tabela,
 * separadas por uma linha de cabeçalho fina. Esconder metade do acervo atrás de um toque é o
 * oposto do que este design promete: se você escolheu densidade, quer ver tudo.
 *
 * A cor trabalha e significa: âmbar para em andamento, verde para em dia, roxo para finalizada.
 * É por isso que o resto da interface é cinza — cor gasta em decoração não fica disponível para
 * dado.
 */
import { Pressable, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HomeShelf, formatEpisodeCode, formatWhen } from '@reprise/shared';
import type { NextUpItem } from '@reprise/shared';
import { useNextUp, usePremieres, useProfile } from '@/api/queries';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { Aviso, MarcarVisto } from '@/design/primitives';
import { useTokens } from '@/design/registry';

export default function PainelProximos() {
  const t = useTokens();
  const status = useAutoSync();
  const query = useNextUp();
  const premieres = usePremieres();
  const profile = useProfile();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {(items) => {
          const { emAndamento, emPausa } = HomeShelf.split(items);
          const nome = profile.data?.displayName?.trim().split(/\s+/)[0];
          const estreias = HomeShelf.upcomingPremieres(premieres.data ?? []);

          if (items.length === 0) {
            return (
              <Aviso titulo="Nada em aberto" texto="Toda série que você acompanha está em dia." />
            );
          }

          const secoes = [
            { key: 'andamento', titulo: 'Em andamento', data: emAndamento },
            { key: 'pausa', titulo: 'Em pausa', data: emPausa },
          ].filter((s) => s.data.length > 0);

          return (
            <SectionList
              sections={secoes}
              keyExtractor={(i) => String(i.seriesId)}
              refreshing={query.isFetching}
              onRefresh={query.refetch}
              contentContainerStyle={{ paddingBottom: t.shape.space(8) }}
              ListHeaderComponent={
                <View style={{ padding: t.shape.space(3), gap: t.shape.space(2) }}>
                  <Text style={[t.shape.eyebrow, { color: t.fgSubtle }]}>
                    Próximos{nome ? ` · ${nome}` : ''}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: t.shape.space(2) }}>
                    <Metrica rotulo="Em andamento" valor={emAndamento.length} cor={t.state.progress} />
                    <Metrica rotulo="Em pausa" valor={emPausa.length} />
                    <Metrica rotulo="Estreias" valor={estreias.length} cor={t.state.upToDate} />
                  </View>
                </View>
              }
              renderSectionHeader={({ section }) => (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingHorizontal: t.shape.space(3),
                    paddingVertical: t.shape.space(1),
                    backgroundColor: t.bgSunken,
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: t.border,
                  }}
                >
                  <Text style={[t.shape.section, { color: t.fgMuted }]}>{section.titulo}</Text>
                  <Text style={[t.shape.section, { color: t.fgSubtle }]}>
                    {section.data.length}
                  </Text>
                </View>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: t.border, marginLeft: t.shape.space(3) }} />
              )}
              renderItem={({ item }) => <LinhaDensa item={item} />}
            />
          );
        }}
      </QueryState>
    </SafeAreaView>
  );
}

function Metrica({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
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
          fontSize: t.shape.font.xl,
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

/** Uma série por linha: nome, episódio, percentual, barra e ação. */
function LinhaDensa({ item }: { item: NextUpItem }) {
  const t = useTokens();
  const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.shape.space(2),
        paddingHorizontal: t.shape.space(3),
        paddingVertical: t.shape.space(2),
      }}
    >
      <Pressable
        onPress={() => router.push(`/series/${item.seriesId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.seriesName}, ${code}`}
        style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', gap: 2 }}
      >
        <Text
          style={{ color: t.fg, fontSize: t.shape.font.base, fontWeight: '600' }}
          numberOfLines={1}
        >
          {item.seriesName}
        </Text>
        <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }} numberOfLines={1}>
          {code}
          {item.episode.name ? ` · ${item.episode.name}` : ''} · {formatWhen(item.lastActivityAt)}
        </Text>
      </Pressable>

      <MarcarVisto item={item} compacto />
    </View>
  );
}
