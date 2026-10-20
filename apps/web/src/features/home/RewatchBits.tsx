import { Repeat, Sparkles, X } from 'lucide-react'
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
 * O selo de "voltou com temporada nova": a série estava Concluída ou Arquivada e a API a devolveu
 * para Assistindo sozinha (ver `ReturnNews`). Cheio, e não suave como o de revisão, porque é
 * notícia — e é o que explica por que uma série parada há anos está no topo da fila.
 */
export function ReturnBadge({ className }: { className?: string }) {
  return (
    <Badge tone="solid" className={className}>
      <Sparkles aria-hidden /> Temporada nova
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
