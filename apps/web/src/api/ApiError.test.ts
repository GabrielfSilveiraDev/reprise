import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError'

describe('ApiError', () => {
  it('usa o detail do ProblemDetails quando a API manda um', () => {
    const error = ApiError.from(403, { title: 'E-mail ainda não validado', detail: 'eu@exemplo.com' })
    expect(error.message).toBe('eu@exemplo.com')
    expect(error.title).toBe('E-mail ainda não validado')
  })

  it('usa a primeira mensagem de campo de um ValidationProblem', () => {
    const error = ApiError.from(400, { errors: { Password: ['Senha curta demais.'] } })
    expect(error.message).toBe('Senha curta demais.')
    expect(error.fieldErrors).toEqual({ password: ['Senha curta demais.'] })
  })

  it('aceita a string JSON pura de alguns 400/404/409', () => {
    expect(ApiError.from(409, 'Já existe uma conta com este e-mail.').message).toBe('Já existe uma conta com este e-mail.')
  })

  it('pede para esperar quando a API recusa por excesso de tentativas', () => {
    expect(ApiError.from(429, null).message).toBe('Muitas tentativas seguidas. Espere um minuto e tente de novo.')
  })
})
