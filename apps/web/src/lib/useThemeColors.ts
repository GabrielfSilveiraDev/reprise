import { useMemo, useSyncExternalStore } from 'react'
import { theme } from './ThemeController'

export interface ChartColors {
  accent: string
  ink: string
  ink2: string
  ink3: string
  line: string
  surface: string
  surface2: string
}

/**
 * As cores do tema resolvidas em valores de verdade, para bibliotecas que desenham SVG por
 * atributo (Recharts). `fill="var(--x)"` em atributo de apresentação não é garantido em todo
 * navegador; ler a variável e passar o valor é. Recalcula quando o tema muda.
 */
export function useThemeColors(): ChartColors {
  const resolved = useSyncExternalStore(theme.subscribe, () => theme.resolved)
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    const read = (name: string) => css.getPropertyValue(name).trim()
    return {
      accent: read('--c-accent'),
      ink: read('--c-ink'),
      ink2: read('--c-ink-2'),
      ink3: read('--c-ink-3'),
      line: read('--c-line'),
      surface: read('--c-surface'),
      surface2: read('--c-surface-2'),
    }
    // `resolved` é a dependência de propósito: as variáveis mudam quando ele muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved])
}
