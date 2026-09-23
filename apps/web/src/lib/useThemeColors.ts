import { useMemo, useSyncExternalStore } from 'react'
import { design } from './DesignController'
import { theme } from './ThemeController'

export interface ChartColors {
  accent: string
  ink: string
  ink2: string
  ink3: string
  line: string
  surface: string
  surface2: string
  /** Raio da ponta das barras, em px: arredondada na Brasa, quase reta na Sessão, reta na Grade. */
  barRadius: number
}

/**
 * As cores do tema e do design resolvidas em valores de verdade, para bibliotecas que desenham SVG
 * por atributo (Recharts). `fill="var(--x)"` em atributo de apresentação não é garantido em todo
 * navegador; ler a variável e passar o valor é. Recalcula quando o tema ou o design muda.
 */
export function useThemeColors(): ChartColors {
  const resolved = useSyncExternalStore(theme.subscribe, () => theme.resolved)
  const current = useSyncExternalStore(design.subscribe, design.getSnapshot)
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    const read = (name: string) => css.getPropertyValue(name).trim()
    const rem = parseFloat(css.fontSize) || 16
    return {
      accent: read('--c-accent'),
      ink: read('--c-ink'),
      ink2: read('--c-ink-2'),
      ink3: read('--c-ink-3'),
      line: read('--c-line'),
      surface: read('--c-surface'),
      surface2: read('--c-surface-2'),
      barRadius: (parseFloat(read('--radius-sm')) || 0) * rem,
    }
    // `resolved` e `current` são as dependências de propósito: as variáveis mudam quando eles mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, current])
}
