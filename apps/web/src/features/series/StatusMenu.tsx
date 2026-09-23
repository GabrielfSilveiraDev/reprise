import { Archive, Bookmark, ChevronDown, CircleCheck, Eye } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTrackingActions } from '@/api/mutations'
import { TRACKING_STATUSES, type TrackingStatus, TrackingStatusInfo } from '@/domain/TrackingStatus'
import { Button } from '@/ui/Button'
import { Menu, MenuContent, MenuLabel, MenuRadio, MenuTrigger } from '@/ui/Controls'

const ICONS: Record<TrackingStatus, ReactNode> = {
  Following: <Eye />,
  ForLater: <Bookmark />,
  Finished: <CircleCheck />,
  Archived: <Archive />,
}

/** Troca o estado de acompanhamento. Não cria nem apaga exibição nenhuma — e o menu diz isso. */
export function StatusMenu({ seriesId, status }: { seriesId: number; status: string }) {
  const { setStatus } = useTrackingActions()
  const current = TrackingStatusInfo.isTracking(status) ? status : null

  if (!current) {
    return (
      <span className="inline-flex h-10 items-center rounded-control border border-dashed border-line-strong px-3 text-sm text-ink-3">
        Fora do acervo — adicione pela busca
      </span>
    )
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline" loading={setStatus.isPending} icon={<span className="[&_svg]:size-4">{ICONS[current]}</span>}>
          {TrackingStatusInfo.label(current)}
          <ChevronDown className="size-4 text-ink-3" />
        </Button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuLabel>Esta série está…</MenuLabel>
        <MenuRadio
          value={current}
          onChange={(next) => setStatus.mutate({ seriesId, status: next })}
          options={TRACKING_STATUSES.map((value) => ({
            value,
            label: TrackingStatusInfo.label(value),
            hint: TrackingStatusInfo.hint(value),
            icon: ICONS[value],
          }))}
        />
      </MenuContent>
    </Menu>
  )
}
