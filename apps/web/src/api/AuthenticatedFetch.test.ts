import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SafeStorage } from '@/lib/SafeStorage'
import { AuthenticatedFetch } from './AuthenticatedFetch'
import { ServerKeyStore } from './ServerKeyStore'
import { SessionStore } from './SessionStore'
import type { Session } from './types'

const session = (n: number, minutesLeft = 20): Session => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  accessTokenExpiresAt: new Date(Date.now() + minutesLeft * 60_000).toISOString(),
  userId: 'u',
  displayName: 'Gabriel',
  email: 'g@example.com',
})

describe('AuthenticatedFetch', () => {
  let storage: SafeStorage
  let sessions: SessionStore
  let serverKey: ServerKeyStore

  beforeEach(() => {
    localStorage.clear()
    storage = new SafeStorage(localStorage)
    sessions = new SessionStore(storage)
    serverKey = new ServerKeyStore(storage)
  })

  /** Servidor falso: aceita só o access token da vez. */
  const server = (validToken: () => string) =>
    vi.fn(async (request: Request) => {
      const ok = request.headers.get('Authorization') === `Bearer ${validToken()}`
      return new Response(ok ? '{}' : null, { status: ok ? 200 : 401 })
    })

  it('quatro pedidos com token recusado disparam UMA renovação e todos repetem com o novo', async () => {
    sessions.set(session(1))
    let valid = 'access-2'
    const refresher = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return session(2)
    })
    const transport = server(() => valid)
    const authed = new AuthenticatedFetch(sessions, serverKey, refresher, transport)

    const responses = await Promise.all(
      [1, 2, 3, 4].map(() => authed.fetch(new Request('http://api/series'))),
    )

    expect(refresher).toHaveBeenCalledTimes(1)
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200])
    expect(sessions.session?.refreshToken).toBe('refresh-2')
    valid = 'nada'
  })

  it('renova antes de pedir quando o token está para vencer', async () => {
    sessions.set(session(1, 0))
    const refresher = vi.fn(async () => session(2))
    const transport = server(() => 'access-2')
    const authed = new AuthenticatedFetch(sessions, serverKey, refresher, transport)

    const response = await authed.fetch(new Request('http://api/me'))

    expect(response.status).toBe(200)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it('adota a sessão que outra aba acabou de renovar em vez de gastar o token de novo', async () => {
    sessions.set(session(1))
    // Outra aba grava a sessão 2 direto no armazenamento; esta aba ainda tem a 1 em memória.
    localStorage.setItem(SessionStore.KEY, JSON.stringify(session(2)))
    const refresher = vi.fn(async () => session(3))
    const authed = new AuthenticatedFetch(sessions, serverKey, refresher, server(() => 'access-2'))

    const response = await authed.fetch(new Request('http://api/me'))

    expect(response.status).toBe(200)
    expect(refresher).not.toHaveBeenCalled()
  })

  it('refresh recusado encerra a sessão e devolve o 401 original', async () => {
    sessions.set(session(1))
    const authed = new AuthenticatedFetch(sessions, serverKey, async () => null, server(() => 'outro'))

    const response = await authed.fetch(new Request('http://api/me'))

    expect(response.status).toBe(401)
    expect(sessions.session).toBeNull()
  })

  it('manda a chave do servidor quando há uma', async () => {
    serverKey.set('  segredo  ')
    const transport = vi.fn(async (_r: Request) => new Response('{}'))
    await new AuthenticatedFetch(sessions, serverKey, async () => null, transport).fetch(new Request('http://api/'))

    expect(transport.mock.calls[0]![0].headers.get(ServerKeyStore.HEADER)).toBe('segredo')
    expect(transport.mock.calls[0]![0].headers.get('Authorization')).toBeNull()
  })
})
