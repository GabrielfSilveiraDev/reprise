import { SafeStorage } from './SafeStorage'

export type DesignId = 'brasa' | 'sessao' | 'grade'

export interface DesignInfo {
  id: DesignId
  name: string
  /** Uma linha, para o seletor. */
  tagline: string
  description: string
}

/**
 * Os três designs do Reprise. Cada um é uma leitura completa do app — cores, tipografia, forma e
 * disposição das telas —, e não uma paleta trocada: o mesmo modelo de dados alimenta as três.
 */
export const DESIGNS: readonly DesignInfo[] = [
  {
    id: 'brasa',
    name: 'Brasa',
    tagline: 'Quente e editorial',
    description: 'Papel morno, laranja de brasa e títulos estreitos. Barra lateral e cartões.',
  },
  {
    id: 'sessao',
    name: 'Sessão',
    tagline: 'Sala escura de cinema',
    description: 'Serifa elegante, dourado de letreiro e os pôsteres em primeiro plano.',
  },
  {
    id: 'grade',
    name: 'Grade',
    tagline: 'Grade de programação',
    description: 'Grotesca suíça, azul-sinal e fios de tabela. Tudo em colunas.',
  },
]

/**
 * Qual design está valendo. O script do index.html aplica o salvo antes do primeiro pixel; daqui
 * em diante é esta classe que mantém o `data-design` do <html> e avisa quem desenha diferente em
 * cada um (a moldura, a tela inicial, o acervo…).
 *
 * A escolha é do navegador, como o tema: é preferência de tela, não dado da conta — o celular
 * pode querer outra coisa que o monitor grande.
 */
export class DesignController {
  static readonly KEY = 'reprise.design'
  static readonly DEFAULT: DesignId = 'brasa'

  private readonly listeners = new Set<() => void>()
  /** A escolha desta aba — vale mesmo quando o navegador não deixa guardar (janela privada). */
  private chosen: DesignId | null = null

  constructor(private readonly storage: SafeStorage = new SafeStorage()) {}

  static isDesign(value: unknown): value is DesignId {
    return DESIGNS.some((d) => d.id === value)
  }

  get current(): DesignId {
    if (this.chosen) return this.chosen
    const saved = this.storage.get(DesignController.KEY)
    return DesignController.isDesign(saved) ? saved : DesignController.DEFAULT
  }

  set(id: DesignId): void {
    this.chosen = id
    if (id === DesignController.DEFAULT) this.storage.remove(DesignController.KEY)
    else this.storage.set(DesignController.KEY, id)
    this.apply()
  }

  apply(): void {
    if (typeof document !== 'undefined') document.documentElement.dataset.design = this.current
    for (const listener of this.listeners) listener()
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): DesignId => this.current
}

export const design = new DesignController()
