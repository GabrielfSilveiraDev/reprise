import { Check } from 'lucide-react'
import { DropdownMenu, Switch as RadixSwitch, ToggleGroup, Tooltip as RadixTooltip } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from './cn'

/* ---------- Menu ---------- */

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' | 'center' }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className="z-50 min-w-52 rounded-panel border border-line bg-surface p-1.5 shadow-pop data-[state=open]:animate-rise grade:border-line-strong"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

const itemClass =
  'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3'

export function MenuItem({
  children,
  onSelect,
  disabled,
  icon,
  hint,
}: {
  children: ReactNode
  onSelect?: () => void
  disabled?: boolean
  icon?: ReactNode
  hint?: string
}) {
  return (
    <DropdownMenu.Item className={itemClass} onSelect={onSelect} disabled={disabled}>
      {icon}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </DropdownMenu.Item>
  )
}

export function MenuRadio<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; hint?: string; icon?: ReactNode }[]
}) {
  return (
    <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
      {options.map((o) => (
        <DropdownMenu.RadioItem key={o.value} value={o.value} className={cn(itemClass, 'items-start')}>
          <span className="mt-0.5">{o.icon}</span>
          <span className="flex-1">
            <span className="block">{o.label}</span>
            {o.hint && <span className="mt-0.5 block text-xs text-ink-3">{o.hint}</span>}
          </span>
          <DropdownMenu.ItemIndicator className="mt-0.5">
            <Check className="!text-accent-ink" />
          </DropdownMenu.ItemIndicator>
        </DropdownMenu.RadioItem>
      ))}
    </DropdownMenu.RadioGroup>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="mx-2 my-1.5 h-px bg-line" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="eyebrow px-3 pt-2 pb-1">{children}</DropdownMenu.Label>
}

/* ---------- Segmented ---------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; count?: number }[]
  label: string
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn('inline-flex gap-1 rounded-control bg-surface-2 p-1 grade:gap-0 grade:border grade:border-line-strong grade:bg-transparent grade:p-0', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="inline-flex h-8 items-center gap-1.5 rounded-control-sm px-3 text-[13px] font-medium whitespace-nowrap text-ink-3 transition-colors hover:text-ink data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-sm grade:h-9 grade:border-r grade:border-line-strong grade:last:border-r-0 grade:data-[state=on]:bg-ink grade:data-[state=on]:text-bg grade:data-[state=on]:shadow-none sessao:data-[state=on]:bg-ink sessao:data-[state=on]:text-bg"
        >
          {o.label}
          {o.count !== undefined && <span className="code text-[11px] text-ink-3">{o.count}</span>}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/* ---------- Switch ---------- */

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-10 shrink-0 rounded-pill bg-surface-3 transition-colors data-[state=checked]:bg-accent"
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-pill bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </RadixSwitch.Root>
      <span className="text-sm">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  )
}

/* ---------- Tooltip ---------- */

export const TooltipProvider = RadixTooltip.Provider

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-bg shadow-pop data-[state=delayed-open]:animate-rise"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}

/* ---------- Kbd / Badge ---------- */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="code rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-[10px] text-ink-3">{children}</kbd>
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'solid' | 'ok'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    accent: 'bg-accent-soft text-accent-ink',
    solid: 'bg-accent text-accent-fg',
    ok: 'bg-surface-2 text-ok',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap [&_svg]:size-3 grade:font-mono grade:text-[10px] grade:font-medium grade:tracking-wide grade:uppercase sessao:tracking-wide', tones[tone], className)}>
      {children}
    </span>
  )
}
