import { cn } from './cn'

/**
 * A marca: a seta de "de novo" em volta de um play. É o nome do app desenhado — reprise é a
 * reexibição —, e funciona sozinha no favicon e no canto da tela no celular.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <g className="stroke-accent-fg" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 16a8 8 0 1 1-4-6.93" />
        <path d="M20.3 5.9l1 3.9-3.9 1" />
      </g>
      <path d="M14 12.6v6.8l5.4-3.4z" className="fill-accent-fg" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-7" />
      <span className="headline text-[22px] leading-none tracking-tight">reprise</span>
    </span>
  )
}
