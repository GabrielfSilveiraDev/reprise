import { Check } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import { design, DesignController, DESIGNS, type DesignId } from '@/lib/DesignController'
import { useDesign } from '@/lib/useDesign'

/**
 * A escolha do design. Cada opção traz uma amostra desenhada COM o próprio design — o <div> da
 * amostra leva `data-design`, e as variáveis de designs.css valem para ele e para o que está
 * dentro. Então a amostra não é uma imagem que envelhece: é o design de verdade, em miniatura,
 * inclusive no tema claro ou escuro em uso.
 */
export function DesignPicker() {
  const current = useDesign()
  return (
    <RadioGroup.Root
      value={current}
      onValueChange={(value) => DesignController.isDesign(value) && design.set(value)}
      aria-label="Design"
      className="grid gap-3 sm:grid-cols-3"
    >
      {DESIGNS.map((d) => (
        <RadioGroup.Item
          key={d.id}
          value={d.id}
          className="group rounded-card border border-line bg-surface p-2 text-left transition-colors outline-none hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:border-accent data-[state=checked]:ring-1 data-[state=checked]:ring-accent"
        >
          <DesignSample id={d.id} />
          <span className="mt-3 flex items-center gap-2 px-1">
            <span className="flex-1 font-semibold">{d.name}</span>
            <RadioGroup.Indicator className="grid size-5 place-items-center rounded-pill bg-accent text-accent-fg">
              <Check className="size-3.5" strokeWidth={3} />
            </RadioGroup.Indicator>
          </span>
          <span className="block px-1 text-xs font-medium text-ink-2">{d.tagline}</span>
          <span className="mt-1 block px-1 pb-1 text-xs text-ink-3">{d.description}</span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}

/** Uma tela de brinquedo: barra, título, episódio, botão e uma fileira do mapa — no design `id`. */
function DesignSample({ id }: { id: DesignId }) {
  return (
    <div data-design={id} aria-hidden className="pointer-events-none overflow-hidden rounded-[calc(var(--radius-card)*0.7)] border border-line bg-bg font-sans text-ink">
      <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5 grade:border-b-2 grade:border-line-strong grade:bg-ink">
        <span className="size-3 rounded-[3px] bg-accent sessao:rounded-full grade:rounded-none" />
        <span className="h-1 w-8 rounded-pill bg-ink-3/50 grade:bg-bg/60" />
        <span className="ml-auto h-1 w-5 rounded-pill bg-ink-3/30 grade:bg-bg/40" />
        <span className="h-1 w-5 rounded-pill bg-ink-3/30 grade:bg-bg/40" />
      </div>
      <div className="p-3">
        <p className="eyebrow !text-[8px]">Continuar</p>
        <p className="headline mt-1 text-[22px] leading-none">Farol do Norte</p>
        <p className="mt-1.5 text-[10px] text-ink-2">
          <span className="code font-semibold text-accent-ink">S03E06</span> Última Chamada
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="rounded-control-sm bg-accent px-2.5 py-1 text-[10px] font-semibold text-accent-fg">Assisti</span>
          <span className="flex gap-0.5">
            {[4, 3, 3, 2, 2, 1, 1, 0].map((level, i) => (
              <span key={i} className={`size-2.5 rounded-[2px] grade:rounded-none ${['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'][level]}`} />
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
