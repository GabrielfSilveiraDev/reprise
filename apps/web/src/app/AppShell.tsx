import { Outlet } from '@tanstack/react-router'
import { CommandPalette } from '@/features/search/CommandPalette'
import { useDesigned } from '@/lib/useDesign'
import { ShellBrasa } from './shell/ShellBrasa'
import { ShellGrade } from './shell/ShellGrade'
import { ShellSessao } from './shell/ShellSessao'
import { useShellFrame } from './shell/useShellFrame'

/**
 * A moldura de quem está logado. O comportamento (sessão, atalhos, paleta) é um só; a forma é do
 * design: barra lateral na Brasa, letreiro no topo na Sessão, faixa de transmissão na Grade. A
 * mesma árvore de rotas nas três — só a navegação muda de lugar.
 */
export function AppShell() {
  const { frame, paletteOpen, setPaletteOpen } = useShellFrame()
  const content = <Outlet />
  const shell = useDesigned({
    brasa: frame && <ShellBrasa frame={frame}>{content}</ShellBrasa>,
    sessao: frame && <ShellSessao frame={frame}>{content}</ShellSessao>,
    grade: frame && <ShellGrade frame={frame}>{content}</ShellGrade>,
  })

  if (!frame) return null

  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      {shell}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  )
}
