import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/**
 * Os ícones do app instalável, gerados do mesmo SVG do favicon. Rodam à mão — `pnpm pwa:icons` —
 * e o resultado é versionado em public/: o gerador usa o sharp, uma biblioteca nativa, e deixá-lo
 * fora do build evita depender dele no CI, no Docker e no Windows com Smart App Control.
 *
 * O ícone "maskable" (o que o Android recorta em círculo, gota ou quadrado) precisa de folga e de
 * fundo cheio: o laranja do próprio logo, para o recorte nunca mostrar uma borda branca.
 */
const BRASA = '#D9481F'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: BRASA } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: BRASA } },
  },
  images: ['public/favicon.svg'],
})
