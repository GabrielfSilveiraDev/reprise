import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { CalendarDays, ChartColumn, LibraryBig, Play, Plus, Search, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Queries } from '@/api/queries'
import { TmdbImage } from '@/domain/TmdbImage'
import { TrackingStatusInfo } from '@/domain/TrackingStatus'

/**
 * Ctrl+K (ou "/"): pular para qualquer série do acervo pelo nome, ir para uma tela, ou levar o
 * texto digitado para a busca no TMDB. O acervo vem do cache — filtrar 120 nomes na hora dispensa
 * servidor.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { data: series } = useQuery({ ...Queries.seriesList(), enabled: open })

  const go = (action: () => void) => {
    onOpenChange(false)
    setQuery('')
    action()
  }
  const term = query.trim()

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Buscar no Reprise"
      loop
      overlayClassName="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
      contentClassName="fixed top-[10vh] left-1/2 z-50 w-[min(94vw,620px)] -translate-x-1/2 overflow-hidden rounded-3xl border border-line bg-surface shadow-pop data-[state=open]:animate-rise"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Série do acervo, uma tela ou algo novo…"
          className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
      </div>

      <Command.List className="max-h-[min(60vh,520px)] overflow-y-auto overscroll-contain p-2 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5">
        <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">Nada no acervo com esse nome.</Command.Empty>

        {term.length >= 2 && (
          <Command.Group heading="Adicionar" forceMount>
            <PaletteItem
              value={`__tmdb ${term}`}
              forceMount
              icon={<Plus />}
              onSelect={() => go(() => void navigate({ to: '/buscar', search: { q: term } }))}
            >
              Procurar “{term}” no TMDB
            </PaletteItem>
          </Command.Group>
        )}

        {series && series.length > 0 && (
          <Command.Group heading="No seu acervo">
            {series.map((s) => (
              <Command.Item
                key={s.id}
                value={`${s.name} #${s.id}`}
                onSelect={() => go(() => void navigate({ to: '/serie/$seriesId', params: { seriesId: s.id } }))}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm data-[selected=true]:bg-surface-2"
              >
                {s.posterPath ? (
                  <img src={TmdbImage.url(s.posterPath, 'w92')!} alt="" className="h-9 w-6 rounded object-cover" loading="lazy" />
                ) : (
                  <span className="h-9 w-6 rounded bg-surface-3" />
                )}
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="text-xs text-ink-3">{TrackingStatusInfo.label(s.status)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Ir para">
          <PaletteItem value="agora inicio" icon={<Play />} onSelect={() => go(() => void navigate({ to: '/' }))}>
            Agora
          </PaletteItem>
          <PaletteItem value="acervo biblioteca" icon={<LibraryBig />} onSelect={() => go(() => void navigate({ to: '/acervo' }))}>
            Acervo
          </PaletteItem>
          <PaletteItem value="agenda estreias calendario" icon={<CalendarDays />} onSelect={() => go(() => void navigate({ to: '/agenda' }))}>
            Agenda de estreias
          </PaletteItem>
          <PaletteItem value="numeros estatisticas" icon={<ChartColumn />} onSelect={() => go(() => void navigate({ to: '/numeros' }))}>
            Números
          </PaletteItem>
          <PaletteItem value="conta exportar sair tema" icon={<UserRound />} onSelect={() => go(() => void navigate({ to: '/conta' }))}>
            Conta e dados
          </PaletteItem>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}

function PaletteItem({
  value,
  icon,
  onSelect,
  children,
  forceMount,
}: {
  value: string
  icon: ReactNode
  onSelect: () => void
  children: ReactNode
  forceMount?: boolean
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      forceMount={forceMount}
      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3"
    >
      {icon}
      {children}
    </Command.Item>
  )
}
