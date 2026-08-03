/**
 * As peças que os designs compartilham.
 *
 * <b>Elas não impõem aparência — recebem tokens.</b> Um botão continua sendo um retângulo tocável
 * de altura mínima 48 em todos os designs; o que muda é o raio, a cor, o peso do texto e o
 * espaçamento, e tudo isso vem de fora. É a diferença entre compartilhar CÓDIGO e compartilhar
 * ESTILO: o primeiro evita reescrever a lógica de marcar episódio três vezes, o segundo faria os
 * três designs parecerem o mesmo.
 *
 * O que NÃO mora aqui: qualquer decisão de composição. Como as peças se arranjam numa tela é
 * exatamente o que distingue um design do outro, e isso vive em cada pasta de design.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatEpisodeCode, posterUrl } from '@reprise/shared';
import type { NextUpItem } from '@reprise/shared';
import { useMarkEpisode } from '@/api/queries';
import { TouchTarget } from '@/constants/theme';
import { useTokens } from './registry';
import type { DesignTokens } from './tokens';

/* ── capa ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * A capa, com a inicial da série por baixo.
 *
 * A inicial não é só o caso "sem pôster": é o estado de carregamento. Retângulo vazio enquanto a
 * imagem chega é indistinguível de imagem que falhou, e o custo de uma capa é o aperto de mão com
 * o CDN (~300 ms), não os 7 KB. Ver a nota de desempenho em `(tabs)/buscar.tsx`.
 */
export function Poster({
  path,
  nome,
  largura,
  aspect,
  radius,
  chave,
}: {
  path: string | null | undefined;
  nome: string;
  largura: number;
  aspect?: number;
  radius?: number;
  chave?: string;
}) {
  const t = useTokens();
  const src = posterUrl(path, largura > 200 ? 'w342' : 'w154');
  const proporcao = aspect ?? t.shape.posterAspect;
  const raio = radius ?? t.shape.radius.md;

  return (
    <View
      style={{
        width: largura,
        aspectRatio: proporcao,
        borderRadius: raio,
        overflow: 'hidden',
        backgroundColor: t.bgSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: t.fgSubtle, fontSize: t.shape.font.lg }}>
        {nome.trim().charAt(0).toUpperCase()}
      </Text>
      {src ? (
        <Image
          source={{ uri: src }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={chave}
        />
      ) : null}
    </View>
  );
}

/* ── botões ────────────────────────────────────────────────────────────────────────────────── */

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  ocupado = false,
  icone,
  style,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'contorno' | 'quieto';
  ocupado?: boolean;
  icone?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();

  const fundo = variante === 'primario' ? t.accent : 'transparent';
  const texto = variante === 'primario' ? t.accentFg : t.fg;
  const borda = variante === 'contorno' ? t.borderStrong : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={ocupado}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={[
        {
          minHeight: TouchTarget,
          paddingHorizontal: t.shape.space(4),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.shape.space(2),
          backgroundColor: fundo,
          borderWidth: variante === 'contorno' ? 1 : 0,
          borderColor: borda,
          borderRadius: t.shape.radius.md,
          opacity: ocupado ? 0.6 : 1,
        },
        style,
      ]}
    >
      {ocupado ? (
        <ActivityIndicator size="small" color={texto} />
      ) : (
        <>
          {icone ? <Ionicons name={icone} size={18} color={texto} aria-hidden /> : null}
          <Text style={{ color: texto, fontSize: t.shape.font.sm, fontWeight: '700' }}>
            {titulo}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Marcar episódio como visto.
 *
 * Existe como peça própria porque a regra é a mesma nos quatro designs e é sutil: **mostrar
 * progresso enquanto envia**. A marcação passa pela fila offline, o envio pode demorar o tempo da
 * rede, e um botão que não confirma que ouviu é um botão que se aperta duas vezes — aqui, apertar
 * duas vezes registra duas exibições de verdade.
 */
export function MarcarVisto({
  item,
  compacto = false,
}: {
  item: NextUpItem;
  compacto?: boolean;
}) {
  const t = useTokens();
  const mark = useMarkEpisode();
  const code = formatEpisodeCode(item.episode.seasonNumber, item.episode.episodeNumber);
  const rotulo = `Marcar ${code} de ${item.seriesName} como visto`;

  if (compacto) {
    return (
      <Pressable
        onPress={() => mark.mutate(item.episode.id)}
        disabled={mark.isPending}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        style={{
          width: TouchTarget,
          height: TouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: t.shape.radius.md,
          backgroundColor: t.accent,
          opacity: mark.isPending ? 0.6 : 1,
        }}
      >
        {mark.isPending ? (
          <ActivityIndicator size="small" color={t.accentFg} />
        ) : (
          <Ionicons name="checkmark" size={22} color={t.accentFg} aria-hidden />
        )}
      </Pressable>
    );
  }

  return (
    <Botao
      titulo="Marcar como visto"
      onPress={() => mark.mutate(item.episode.id)}
      ocupado={mark.isPending}
      icone="checkmark"
    />
  );
}

/* ── progresso e selos ─────────────────────────────────────────────────────────────────────── */

export function Progresso({
  ratio,
  cor,
  altura = 4,
}: {
  ratio: number;
  cor?: string;
  altura?: number;
}) {
  const t = useTokens();
  const pct = Math.max(0, Math.min(1, ratio));

  return (
    <View
      style={{
        height: altura,
        borderRadius: altura / 2,
        backgroundColor: t.trackEmpty,
        overflow: 'hidden',
      }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          backgroundColor: cor ?? t.state.progress,
        }}
      />
    </View>
  );
}

/** Selo de estado. Texto sempre — cor é reforço, nunca o único canal. */
export function Selo({ texto, cor }: { texto: string; cor?: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        paddingHorizontal: t.shape.space(2),
        paddingVertical: 2,
        borderRadius: t.shape.radius.sm,
        backgroundColor: cor ?? t.accentQuiet,
      }}
    >
      <Text
        style={{
          color: cor ? t.state.fg : t.fg,
          fontSize: t.shape.font.xs,
          fontWeight: '700',
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

/* ── estrutura de tela ─────────────────────────────────────────────────────────────────────── */

export function Eyebrow({ children }: { children: ReactNode }) {
  const t = useTokens();
  return <Text style={[t.shape.eyebrow, { color: t.fgSubtle }]}>{children}</Text>;
}

export function TituloTela({ children }: { children: ReactNode }) {
  const t = useTokens();
  return <Text style={[t.shape.title, { color: t.fg }]}>{children}</Text>;
}

export function TituloSecao({ children }: { children: ReactNode }) {
  const t = useTokens();
  return <Text style={[t.shape.section, { color: t.fg }]}>{children}</Text>;
}

/** Aviso de tela vazia ou de erro, no tom do design. */
export function Aviso({ titulo, texto }: { titulo: string; texto?: string }) {
  const t = useTokens();
  return (
    <View style={{ padding: t.shape.space(6), gap: t.shape.space(2) }}>
      <Text style={{ color: t.fg, fontSize: t.shape.font.lg, fontWeight: '700' }}>{titulo}</Text>
      {texto ? (
        <Text style={{ color: t.fgMuted, fontSize: t.shape.font.base, lineHeight: 22 }}>
          {texto}
        </Text>
      ) : null}
    </View>
  );
}

/** Um bloco com o tratamento de superfície do design (borda, elevação, raio). */
export function Cartao({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  return (
    <View
      style={[
        {
          backgroundColor: t.bgRaised,
          borderRadius: t.shape.radius.lg,
          borderWidth: t.shape.cardBorder ? 1 : 0,
          borderColor: t.border,
          elevation: t.shape.elevation,
          padding: t.shape.space(3),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type { DesignTokens };
