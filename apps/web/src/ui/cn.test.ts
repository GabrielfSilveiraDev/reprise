import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('a classe de quem usa vence a da base, inclusive nos tokens próprios', () => {
    expect(cn('inline-flex h-10', 'hidden sm:inline-flex')).toBe('h-10 hidden sm:inline-flex')
    expect(cn('rounded-xl bg-surface-3', 'rounded-card')).toBe('bg-surface-3 rounded-card')
    expect(cn('shadow-sm', 'shadow-pop')).toBe('shadow-pop')
    expect(cn('text-sm text-ink-3', 'text-accent-ink')).toBe('text-sm text-accent-ink')
  })

  it('os raios de papel (controle, pôster…) substituem os de tamanho, e as variantes de design não brigam', () => {
    expect(cn('rounded-poster', 'rounded-md')).toBe('rounded-md')
    expect(cn('rounded-control h-8', 'rounded-pill')).toBe('h-8 rounded-pill')
    expect(cn('rounded-card grade:rounded-none', 'sessao:rounded-none')).toBe('rounded-card grade:rounded-none sessao:rounded-none')
  })
})
