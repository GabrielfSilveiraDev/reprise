import { SeriesProgress, type ProgressNumbers } from '@/domain/SeriesProgress'
import { Fmt } from '@/lib/format'
import { cn } from './cn'

/**
 * Barra de progresso em três partes: visto (acento), lançado e não visto (tom claro do acento) e
 * ainda por lançar (trilho). Uma barra de duas cores não distingue "estou atrasado" de "a série
 * anunciou mais episódios" — e essa é a pergunta que a pessoa faz ao olhar para ela.
 */
export function ProgressBar({ numbers, className, thin = false }: { numbers: ProgressNumbers; className?: string; thin?: boolean }) {
  const p = new SeriesProgress(numbers)
  const total = Math.max(1, p.total)
  const watched = (p.watched / total) * 100
  const backlog = (p.backlog / total) * 100

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={p.total}
      aria-valuenow={p.watched}
      aria-valuetext={`${Fmt.number(p.watched)} de ${Fmt.number(p.total)} episódios vistos, ${p.summary}`}
      className={cn('flex w-full overflow-hidden rounded-pill bg-surface-3', thin ? 'h-1' : 'h-1.5', className)}
    >
      <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${watched}%` }} />
      {backlog > 0 && (
        <div className="h-full bg-heat-1 opacity-70 transition-[width] duration-500" style={{ width: `${backlog}%`, marginLeft: watched > 0 ? 2 : 0 }} />
      )}
    </div>
  )
}
