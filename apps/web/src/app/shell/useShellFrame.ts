import { useRouter } from '@tanstack/react-router'
import { CalendarDays, ChartColumn, LibraryBig, Play } from 'lucide-react'
import { type ComponentType, useEffect, useState } from 'react'
import { api } from '@/api/RepriseApi'
import type { Session } from '@/api/types'
import { initialsOf, useSession } from '../useSession'

export type NavTarget = '/' | '/acervo' | '/agenda' | '/numeros'

export interface NavItem {
  to: NavTarget
  label: string
  icon: ComponentType<{ className?: string }>
}

/** As quatro telas de cima. Iguais nos três designs: trocar de design não pode esconder um lugar. */
export const NAV: readonly NavItem[] = [
  { to: '/', label: 'Agora', icon: Play },
  { to: '/acervo', label: 'Acervo', icon: LibraryBig },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/numeros', label: 'Números', icon: ChartColumn },
]

/** `activeOptions` do link de cada item: "Agora" só é ativo na raiz, e filtros na URL não contam. */
export const navActive = (to: NavTarget) => ({ exact: to === '/', includeSearch: false })

export interface ShellFrame {
  session: Session
  initials: string
  openPalette: () => void
}

/**
 * O comportamento da moldura, que é o mesmo nos três designs — só o desenho muda:
 *
 * - sessão encerrada volta para o login (lembrando onde estava, se não foi um "Sair");
 * - Ctrl+K ou "/" abre a paleta de busca.
 */
export function useShellFrame() {
  const session = useSession()
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Sessão encerrada: volta para o login. Se ela caiu sozinha (refresh recusado, saiu em outra
  // aba), lembra onde a pessoa estava; se ela clicou em Sair, não. O endereço é lido na hora, e
  // não é dependência do efeito — senão cada navegação dispararia outra.
  useEffect(() => {
    if (session) return
    const redirect = api.sessions.endedBy === 'logout' ? undefined : router.state.location.href
    void router.navigate({ to: '/entrar', search: { redirect }, replace: true })
  }, [session, router])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const frame: ShellFrame | null = session
    ? { session, initials: initialsOf(session.displayName), openPalette: () => setPaletteOpen(true) }
    : null

  return { frame, paletteOpen, setPaletteOpen }
}
