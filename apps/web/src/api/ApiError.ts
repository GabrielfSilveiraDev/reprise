/**
 * Erro de API com o que a tela precisa para responder bem: o status e uma mensagem já legível.
 *
 * A API responde de três formas: ProblemDetails (`{ title, detail }`), ValidationProblem
 * (`{ errors: { campo: [...] } }`) e, em alguns 400/404/409, uma string JSON pura. Esta classe
 * junta as três numa mensagem só, para nenhuma tela precisar saber qual veio.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly title: string | null = null,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static from(status: number, body: unknown): ApiError {
    if (typeof body === 'string' && body.trim()) return new ApiError(status, body)

    if (body && typeof body === 'object') {
      const problem = body as { title?: unknown; detail?: unknown; errors?: unknown }
      const errors = ApiError.fieldErrorsOf(problem.errors)
      const firstFieldError = Object.values(errors)[0]?.[0]
      const detail = typeof problem.detail === 'string' ? problem.detail : null
      const title = typeof problem.title === 'string' ? problem.title : null
      const message = detail ?? firstFieldError ?? title ?? ApiError.fallback(status)
      return new ApiError(status, message, title, errors)
    }
    return new ApiError(status, ApiError.fallback(status))
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  /** Recurso opcional desligado no servidor (hoje: TMDB sem chave). */
  get isUnavailable(): boolean {
    return this.status === 503
  }

  private static fieldErrorsOf(errors: unknown): Record<string, string[]> {
    if (!errors || typeof errors !== 'object') return {}
    const result: Record<string, string[]> = {}
    for (const [field, messages] of Object.entries(errors)) {
      if (Array.isArray(messages)) result[field.toLowerCase()] = messages.map(String)
    }
    return result
  }

  private static fallback(status: number): string {
    if (status === 401) return 'Sua sessão expirou. Entre de novo.'
    if (status === 403) return 'Você não tem permissão para isso.'
    if (status === 404) return 'Não encontrado.'
    if (status >= 500) return 'O servidor do Reprise teve um problema. Tente de novo em instantes.'
    return 'Não deu certo. Tente de novo.'
  }
}

/** Falha de rede (API fora do ar, sem conexão) — distinta de uma resposta de erro. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Não foi possível falar com o servidor do Reprise. Ele está de pé?')
    this.name = 'NetworkError'
    this.cause = cause
  }
}
