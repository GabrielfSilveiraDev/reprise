import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Junta classes e resolve conflitos do Tailwind: num `<Button className="hidden sm:inline-flex">`
 * o `hidden` de quem usa precisa vencer o `inline-flex` da base — na folha de estilo, quem vence é
 * a ordem das regras, não a do atributo. O tailwind-merge é quem conhece esses grupos; aqui ele só
 * aprende os tokens próprios do Reprise.
 */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['card', 'panel', 'control', 'control-sm', 'poster', 'pill'],
      shadow: ['pop'],
      animate: ['pop', 'rise', 'shimmer'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs))
}
