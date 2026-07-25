import Svg, { Path, Rect } from 'react-native-svg';
import { LOGO_BARS, LOGO_RETURN_ARC, LOGO_VIEWBOX } from '@reprise/shared';
import { useTheme } from '@/hooks/use-theme';

/**
 * A marca no Android.
 *
 * <b>Desenhada com `react-native-svg`, e não como imagem.</b> A primeira versão passava o SVG
 * como data URI para o `expo-image` — que anuncia suporte a SVG, mas não renderiza data URI de
 * forma confiável no Android: o resultado foi um espaço em branco no lugar do símbolo. Com nós
 * de verdade, o Android desenha vetor nativo, escala sem borrar e a cor vem do tema.
 *
 * A GEOMETRIA continua vindo do pacote compartilhado, então o web e o app desenham o mesmo
 * símbolo a partir da mesma fonte — só o mecanismo de desenho difere, que é o que tem de diferir
 * entre HTML e Android.
 */
export function Logo({ size = 28 }: { size?: number }) {
  const t = useTheme();

  return (
    <Svg
      width={size}
      height={size}
      viewBox={LOGO_VIEWBOX}
      // Decorativo: o nome "Reprise" está escrito ao lado em texto de verdade.
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Path
        d={LOGO_RETURN_ARC}
        fill="none"
        stroke={t.accent}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.55}
      />
      {LOGO_BARS.map((bar, i) => (
        <Rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          rx={1.2}
          // Da rampa da trilha, do mais claro ao mais escuro — o mesmo gradiente de intensidade
          // que os blocos de episódio usam.
          fill={t.track[i] ?? t.accent}
        />
      ))}
    </Svg>
  );
}
