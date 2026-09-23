#!/usr/bin/env node
/**
 * Confere o contraste das paletas de src/styles/designs.css (WCAG 2.x). Lê as cores do próprio CSS
 * — uma tabela copiada à mão envelheceria no primeiro ajuste de cor.
 *
 *   node scripts/check-contrast.mjs
 *
 * Sai com código 1 se algum par ficar abaixo do mínimo, para servir de verificação antes de commit.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

class Color {
  constructor(hex) {
    const h = hex.replace('#', '')
    this.rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  }

  get luminance() {
    const [r, g, b] = this.rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  contrast(other) {
    const [a, b] = [this.luminance, other.luminance].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  }
}

class PaletteFile {
  constructor(css) {
    this.blocks = []
    for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').pop().trim()
      const colors = Object.fromEntries(
        [...match[2].matchAll(/--c-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], new Color(m[2])]),
      )
      if (Object.keys(colors).length > 0) this.blocks.push({ selector, colors })
    }
  }
}

/** [frente, fundo, mínimo, por quê] */
const PAIRS = [
  ['ink', 'bg', 7, 'texto principal'],
  ['ink-2', 'bg', 4.5, 'texto secundário'],
  ['ink-3', 'bg', 4.5, 'legenda'],
  ['ink-3', 'surface', 4.5, 'legenda em cartão'],
  ['ink-3', 'surface-2', 4, 'legenda em campo'],
  ['accent-fg', 'accent', 4.5, 'botão principal'],
  ['accent-ink', 'bg', 4.5, 'link'],
  ['accent-ink', 'surface', 4.5, 'link em cartão'],
  ['accent-ink', 'accent-soft', 4.5, 'selo de acento'],
  ['ok', 'surface', 4.5, 'texto de sucesso'],
  ['danger', 'surface', 4.5, 'texto de erro'],
  ['heat-1', 'heat-0', 1.4, 'mapa: 1º degrau visível sobre o vazio'],
  ['heat-4', 'surface', 3, 'mapa: degrau mais forte'],
]

const file = new PaletteFile(readFileSync(fileURLToPath(new URL('../src/styles/designs.css', import.meta.url)), 'utf8'))
let failures = 0

for (const { selector, colors } of file.blocks) {
  console.log(`\n${selector}`)
  for (const [fg, bg, min, why] of PAIRS) {
    if (!colors[fg] || !colors[bg]) continue
    const ratio = colors[fg].contrast(colors[bg])
    const ok = ratio >= min
    if (!ok) failures += 1
    console.log(`  ${ok ? 'ok ' : 'FALHA'} ${ratio.toFixed(2).padStart(5)} ≥ ${min}  ${fg} / ${bg} — ${why}`)
  }
  // A escala do mapa tem de subir sempre na mesma direção de contraste com a superfície.
  const steps = [1, 2, 3, 4].map((i) => colors[`heat-${i}`].contrast(colors.surface))
  const monotonic = steps.every((v, i) => i === 0 || v > steps[i - 1])
  if (!monotonic) failures += 1
  console.log(`  ${monotonic ? 'ok ' : 'FALHA'} escala do mapa monótona: ${steps.map((v) => v.toFixed(2)).join(' < ')}`)
}

console.log(failures ? `\n${failures} par(es) abaixo do mínimo.` : '\nTodas as paletas passam.')
process.exit(failures ? 1 : 0)
