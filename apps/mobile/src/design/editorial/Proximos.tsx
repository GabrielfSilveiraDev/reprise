/**
 * Próximos — editorial.
 *
 * <b>Sumário de revista.</b> Nada de capa grande: a hierarquia é feita por TAMANHO e PESO de
 * texto, separada por fio de cabelo. O nome da série é a manchete; o episódio, a linha fina; a
 * capa, uma miniatura discreta à direita — presente para reconhecimento, nunca no comando.
 *
 * <b>A prova de que a hierarquia é real</b> é que esta tela continua legível impressa em preto e
 * branco. Nenhum nível de informação depende de cor ou de caixa colorida para se distinguir do
 * anterior, que é a armadilha do design que hierarquiza por fundo.
 *
 * O respiro é o material principal: a escala de espaçamento deste design é 1,5× a dos outros, e é
 * isso — não a fonte — que faz a tela parecer impressa.
 */
import { useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HomeShelf, formatEpisodeCode, formatWhen } from '@reprise/shared';
import type { NextUpItem } from '@reprise/shared';
import { useNextUp, usePremieres, useProfile } from '@/api/queries';
import { QueryState } from '@/components/query-state';
import { SyncBar } from '@/components/sync-bar';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { Aviso, MarcarVisto, Poster } from '@/design/primitives';
import { useTokens } from '@/design/registry';

export default function EditorialProximos() {
  const t = useTokens();
  const status = useAutoSync();
  const query = useNextUp();
  const premieres = usePremieres();
  const profile = useProfile();

  const [pausaAberto, setPausaAberto] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <SyncBar status={status} />

      <QueryState query={query}>
        {(items) => {
          const { emAndamento, emPausa } = HomeShelf.split(items);
          const nome = profile.data?.displayName?.trim().split(/\s+/)[0];
          const estreias = HomeShelf.upcomingPremieres(premieres.data ?? []);

          if (emAndamento.length === 0 && emPausa.length === 0) {
            return (
              <Aviso titulo="Nada em aberto" texto="Toda série que você acompanha está em dia." />
            );
          }

          const secoes = [
            { key: 'andamento', titulo: 'Continuar', data: emAndamento },
            {
              key: 'pausa',
              titulo: 'Em pausa',
              data: pausaAberto ? emPausa : ([] as NextUpItem[]),
            },
          ].filter((s) => s.key !== 'andamento' || emAndamento.length > 0);

          return (
            <SectionList
              sections={secoes}
              keyExtractor={(i) => String(i.seriesId)}
              refreshing={query.isFetching}
              onRefresh={query.refetch}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{
                paddingHorizontal: t.shape.space(4),
                paddingBottom: t.shape.space(8),
              }}
              ListHeaderComponent={
                <View style={{ paddingVertical: t.shape.space(5), gap: t.shape.space(2) }}>
                  <Text style={[t.shape.eyebrow, { color: t.accent }]}>Reprise</Text>
                  <Text style={[t.shape.title, { color: t.fg }]}>
                    {HomeShelf.greeting()}
                    {nome ? `, ${nome}` : ''}.
                  </Text>
                  <Text
                    style={{
                      color: t.fgMuted,
                      fontSize: t.shape.font.base,
                      lineHeight: t.shape.font.base * 1.6,
                    }}
                  >
                    {HomeShelf.summary(emAndamento.length, emPausa.length)}
                  </Text>

                  {estreias.length > 0 ? (
                    <View
                      style={{
                        marginTop: t.shape.space(3),
                        paddingTop: t.shape.space(3),
                        borderTopWidth: 1,
                        borderTopColor: t.border,
                        gap: t.shape.space(1),
                      }}
                    >
                      <Text style={[t.shape.section, { color: t.fgSubtle }]}>Estreias</Text>
                      {estreias.slice(0, 3).map((p) => (
                        <Text
                          key={`${p.seriesId}-${p.airDate}`}
                          style={{ color: t.fgMuted, fontSize: t.shape.font.sm }}
                        >
                          {p.seriesName} · {formatEpisodeCode(p.seasonNumber, p.episodeNumber)} ·{' '}
                          {formatWhen(p.airDate)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              }
              renderSectionHeader={({ section }) => {
                if (section.key === 'pausa') {
                  if (emPausa.length === 0) return null;
                  return (
                    <Pressable
                      onPress={() => setPausaAberto((v) => !v)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: pausaAberto }}
                      accessibilityLabel={`Em pausa, ${emPausa.length} séries`}
                      style={{
                        marginTop: t.shape.space(5),
                        paddingVertical: t.shape.space(2),
                        borderTopWidth: 1,
                        borderTopColor: t.fg,
                        minHeight: 48,
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={[t.shape.section, { color: t.fg }]}>
                        {section.titulo} · {emPausa.length} {pausaAberto ? '—' : '+'}
                      </Text>
                    </Pressable>
                  );
                }
                return (
                  <View
                    style={{
                      paddingVertical: t.shape.space(2),
                      borderTopWidth: 1,
                      borderTopColor: t.fg,
                    }}
                  >
                    <Text style={[t.shape.section, { color: t.fg }]}>{section.titulo}</Text>
                  </View>
                );
              }}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: t.border }} />
              )}
              renderItem={({ item }) => <Linha item={item} />}
            />
          );
        }}
      </QueryState>
    </SafeAreaView>
  );
}

/** Uma entrada do sumário: manchete, linha fina, miniatura e a ação embaixo. */
function Linha({ item }: { item: NextUpItem }) {
  const t = useTokens();
  const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);

  return (
    <View style={{ paddingVertical: t.shape.space(4), gap: t.shape.space(3) }}>
      <Pressable
        onPress={() => router.push(`/series/${item.seriesId}`)}
        accessibilityRole="button"
        accessibilityLabel={item.seriesName}
        style={{ flexDirection: 'row', gap: t.shape.space(3), alignItems: 'flex-start' }}
      >
        <View style={{ flex: 1, gap: t.shape.space(1) }}>
          <Text
            style={{
              color: t.fg,
              fontSize: t.shape.font.lg,
              fontWeight: '700',
              letterSpacing: -0.3,
              lineHeight: t.shape.font.lg * 1.25,
            }}
            numberOfLines={2}
          >
            {item.seriesName}
          </Text>
          <Text style={{ color: t.fgMuted, fontSize: t.shape.font.sm }} numberOfLines={2}>
            {code}
            {item.episode.name ? ` · ${item.episode.name}` : ''}
          </Text>
          <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.xs }}>
            {formatWhen(item.lastActivityAt)}
          </Text>
        </View>

        {/* Miniatura pequena e à direita: reconhecimento, não protagonismo. */}
        <Poster
          path={item.posterPath}
          nome={item.seriesName}
          largura={48}
          chave={String(item.seriesId)}
        />
      </Pressable>

      <MarcarVisto item={item} />
    </View>
  );
}
