/**
 * Leitura defensiva dos parâmetros de URL. A URL é entrada de fora — alguém cola um link velho,
 * edita à mão —, então todo valor inválido vira "ausente" em vez de quebrar a tela.
 */
export class SearchParams {
  static text(value: unknown): string | undefined {
    if (typeof value === 'number') return String(value)
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  static int(value: unknown): number | undefined {
    const n = typeof value === 'string' ? Number(value) : value
    return typeof n === 'number' && Number.isInteger(n) ? n : undefined
  }

  static flag(value: unknown): boolean | undefined {
    if (value === true || value === 'true' || value === 1 || value === '1') return true
    if (value === false || value === 'false' || value === 0 || value === '0') return false
    return undefined
  }

  static oneOf<T extends string>(value: unknown, options: readonly T[]): T | undefined {
    return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : undefined
  }
}
