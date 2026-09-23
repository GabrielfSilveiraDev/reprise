import { X } from 'lucide-react'
import { AlertDialog, Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './cn'

/**
 * Painel lateral no desktop, folha de baixo no celular. Mesmo componente, porque o conteúdo é o
 * mesmo — só muda de onde ele entra.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[rise_200ms_ease-out]" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-surface shadow-pop outline-none',
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl',
            'md:inset-y-3 md:right-3 md:left-auto md:max-h-none md:w-[440px] md:rounded-3xl',
            'data-[state=open]:animate-rise',
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong md:hidden" aria-hidden />
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {description ? <Dialog.Description className="sr-only">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-10 bg-surface/80 backdrop-blur" aria-label="Fechar">
              <X className="size-4" />
            </Button>
          </Dialog.Close>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Confirmação para o que muda muita coisa de uma vez (marcar uma temporada inteira, sair). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface p-6 shadow-pop data-[state=open]:animate-rise">
          <AlertDialog.Title className="headline text-2xl">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-sm text-ink-2">{description}</div>
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancelar</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
