import { Repeat, X } from 'lucide-react'
import { Button } from '@/ui/Button'
import { Badge, Tooltip } from '@/ui/Controls'
import { cn } from '@/ui/cn'

/** O selo de "você está revendo isto" — o mesmo nos três designs, cada um o veste com seus tokens. */
export function RewatchBadge({ className }: { className?: string }) {
  return (
    <Badge tone="accent" className={className}>
      <Repeat aria-hidden /> Revendo
    </Badge>
  )
}

/**
 * O "tirar do Continuar" de uma revisão. Um ícone com dica, e não um texto, porque mora ao lado do
 * "Assisti" e não pode competir com ele; o aviso que vem depois tem "Desfazer".
 */
export function DismissRewatchButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <Tooltip content="Tirar do Continuar">
      <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className={cn('text-ink-3', className)} icon={<X className="size-4" />} />
    </Tooltip>
  )
}
