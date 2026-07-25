import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { stillUrl } from '@reprise/shared';
import { FontSize, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const THUMB_WIDTH = 88;
export const THUMB_HEIGHT = 50;

/**
 * A miniatura do episódio — com imagem quando o TMDB tem, e com uma **cartela de número**
 * quando não tem.
 *
 * O tratamento anterior era um retângulo cinza com o código dentro, do mesmo tamanho da foto.
 * O problema é que isso é indistinguível de uma imagem que falhou ao carregar: lê-se como defeito,
 * não como ausência. E a ausência aqui é sistemática, não acidental — 34% dos especiais não têm
 * imagem no TMDB —, então a lista de especiais inteira parecia quebrada.
 *
 * A cartela resolve isso invertendo a intenção: em vez de fingir ser uma foto que não existe, ela
 * assume o espaço como tipografia. Número grande, rótulo pequeno, fundo do próprio tema e uma
 * borda fina — o mesmo vocabulário do resto da interface. Mantém o alinhamento da grade (a
 * altura das linhas não oscila entre episódios com e sem capa) e não promete uma imagem.
 */
export function EpisodeThumb({
  seasonNumber,
  episodeNumber,
  stillPath,
  watched,
}: {
  seasonNumber: number;
  episodeNumber: number;
  stillPath?: string | null;
  watched: boolean;
}) {
  const t = useTheme();
  const still = stillUrl(stillPath, 'w185');

  if (still) {
    return (
      <Image
        source={still}
        style={[styles.frame, { backgroundColor: t.bgSunken }]}
        contentFit="cover"
        transition={120}
      />
    );
  }

  const special = seasonNumber === 0;
  return (
    <View
      style={[
        styles.frame,
        styles.plate,
        {
          backgroundColor: t.bgSunken,
          borderColor: watched ? t.borderStrong : t.border,
        },
      ]}
    >
      <Text style={[styles.plateLabel, { color: t.fgSubtle }]}>{special ? 'ESP' : `T${seasonNumber}`}</Text>
      <Text style={[styles.plateNumber, { color: t.fgMuted }]}>{episodeNumber}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: Radius.sm },
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 0,
  },
  plateLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  plateNumber: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
});
