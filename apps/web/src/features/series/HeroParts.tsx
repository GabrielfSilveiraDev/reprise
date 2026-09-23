import { useState } from 'react'
import { cn } from '@/ui/cn'

/** A sinopse da série, recolhida em três linhas quando é longa. Igual nos três designs. */
export function Overview({ text, className }: { text: string | null; className?: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  return (
    <div className={className}>
      <p className={cn('text-ink-2', !expanded && 'line-clamp-3')}>{text}</p>
      {text.length > 240 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-medium text-accent-ink hover:underline">
          {expanded ? 'Menos' : 'Mais'}
        </button>
      )}
    </div>
  )
}
