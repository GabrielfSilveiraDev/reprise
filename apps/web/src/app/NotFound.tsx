import { Link } from '@tanstack/react-router'
import { Button } from '@/ui/Button'

export function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6 text-center">
      <div>
        <p className="code text-sm text-ink-3">S00E404</p>
        <h1 className="headline mt-2 text-5xl">Episódio perdido</h1>
        <p className="mt-3 text-ink-2">Esta página não existe — ou saiu do ar.</p>
        <Button asChild variant="primary" className="mt-6">
          <Link to="/">Voltar para o começo</Link>
        </Button>
      </div>
    </div>
  )
}
