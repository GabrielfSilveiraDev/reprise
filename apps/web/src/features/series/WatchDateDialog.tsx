import { format, set, subDays } from 'date-fns'
import { Dialog } from 'radix-ui'
import { type FormEvent, useState } from 'react'
import { useEpisodeActions } from '@/api/mutations'
import type { Episode } from '@/api/types'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { Button } from '@/ui/Button'

const toInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

/**
 * Registrar uma exibição no passado — o episódio visto no avião, a maratona de ontem que
 * ninguém marcou na hora. A data é o que alimenta sequências, calendário e as "vezes" da série,
 * então vale o trabalho de acertá-la.
 */
export function WatchDateDialog({
  target,
  onClose,
}: {
  target: { seriesId: number; seriesName: string; episode: Episode } | null
  onClose: () => void
}) {
  return (
    <Dialog.Root open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface p-6 shadow-pop data-[state=open]:animate-rise">
          {target && <Form key={target.episode.id} target={target} onDone={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Form({ target, onDone }: { target: { seriesId: number; seriesName: string; episode: Episode }; onDone: () => void }) {
  const now = new Date()
  const [value, setValue] = useState(toInput(now))
  const [error, setError] = useState<string | null>(null)
  const { mark } = useEpisodeActions()
  const code = EpisodeCode.of(target.episode)

  const presets = [
    { label: 'Agora', date: now },
    { label: 'Ontem à noite', date: set(subDays(now, 1), { hours: 21, minutes: 0 }) },
    { label: 'Há uma semana', date: set(subDays(now, 7), { hours: 21, minutes: 0 }) },
  ]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return setError('Escolha uma data válida.')
    if (date > new Date()) return setError('A data não pode estar no futuro.')
    mark.mutate({ ...target, watchedAt: date })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <Dialog.Title className="headline text-2xl">Quando você viu?</Dialog.Title>
      <Dialog.Description className="mt-1 text-sm text-ink-2">
        {target.seriesName} · <span className="code">{code.toString()}</span>
        {target.episode.name && ` — ${target.episode.name}`}
      </Dialog.Description>

      <div className="mt-5 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setValue(toInput(p.date))
              setError(null)
            }}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm">
        <span className="mb-1.5 block text-xs text-ink-3">Data e hora</span>
        <input
          type="datetime-local"
          required
          value={value}
          max={toInput(now)}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-line-strong"
        />
      </label>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <Dialog.Close asChild>
          <Button variant="ghost">Cancelar</Button>
        </Dialog.Close>
        <Button type="submit" variant="primary">
          Registrar
        </Button>
      </div>
    </form>
  )
}
