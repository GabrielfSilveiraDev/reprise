import { useDesign } from '@/lib/useDesign'
import { cn } from './cn'

/** O canto do selo em cada design: arredondado (Brasa), círculo (Sessão), reto (Grade). */
const CORNER = { brasa: 9, sessao: 16, grade: 0 } as const

/**
 * A marca: a seta de "de novo" em volta de um play. É o nome do app desenhado — reprise é a
 * reexibição —, e funciona sozinha no favicon e no canto da tela no celular. O desenho é o mesmo
 * nos três designs; muda o recorte do selo.
 */
export function LogoMark({ className }: { className?: string }) {
  const design = useDesign()
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx={CORNER[design]} className="fill-accent" />
      <g className="stroke-accent-fg" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 16a8 8 0 1 1-4-6.93" />
        <path d="M20.3 5.9l1 3.9-3.9 1" />
      </g>
      <path d="M14 12.6v6.8l5.4-3.4z" className="fill-accent-fg" />
    </svg>
  )
}

/** Selo + nome. O nome é escrito na voz de cada design: estreito, itálico de cinema, grotesca pesada. */
export function Logo({ className }: { className?: string }) {
  const design = useDesign()
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-7" />
      {design === 'sessao' ? (
        <span className="headline text-[26px] leading-none italic">Reprise</span>
      ) : design === 'grade' ? (
        <span className="headline text-[21px] leading-none">reprise.</span>
      ) : (
        <span className="headline text-[22px] leading-none tracking-tight">reprise</span>
      )}
    </span>
  )
}
