import { Image } from 'expo-image';
import { repriseLogoDataUri } from '@reprise/shared';
import { useTheme } from '@/hooks/use-theme';

/**
 * A marca no Android.
 *
 * Vem da MESMA função que o web usa (`repriseLogoSvg`, em `@reprise/shared`), entregue como data
 * URI porque o `expo-image` renderiza SVG nativamente. Dois arquivos de imagem separados seriam a
 * receita para o símbolo divergir entre as plataformas — que é exatamente o problema que esta
 * rodada passou consertando em outros lugares.
 *
 * A cor vem do tema, então o símbolo acompanha claro e escuro sem uma segunda versão.
 */
export function Logo({ size = 28 }: { size?: number }) {
  const t = useTheme();

  return (
    <Image
      source={{ uri: repriseLogoDataUri({ size, color: t.accent }) }}
      style={{ width: size, height: size }}
      contentFit="contain"
      // Decorativo: o nome "Reprise" já está escrito ao lado em texto de verdade.
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
