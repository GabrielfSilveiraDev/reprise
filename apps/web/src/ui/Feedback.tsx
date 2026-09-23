import { RotateCcw, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-lg', className)} />
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-card border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-3 [&_svg]:size-6">{icon}</div>}
      <h3 className="headline text-xl">{title}</h3>
      {children && <p className="mt-2 max-w-md text-sm text-ink-3">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : 'Algo deu errado.'
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-card border border-line bg-surface p-4', className)}>
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Não deu para carregar</p>
        <p className="mt-0.5 text-sm text-ink-3">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
