import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { SafeStorage } from '@/lib/SafeStorage'
import { SESSION_LOCK } from './AuthenticatedFetch'
import { LauncherLogin } from './LauncherLogin'
import { SessionStore } from './SessionStore'
import type { Session } from './types'

const session = (n: number, userId = 'u'): Session => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  accessTokenExpiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
  userId,
  displayName: 'Gabriel',
  email: 'g@example.com',
})

type Exchange = (ticket: string, signal?: AbortSignal) => Promise<Session | null>
type Revoke = (refreshToken: string) => Promise<void>

describe('LauncherLogin', () => {
  let sessions: SessionStore
  let auth: { launcher: Mock<Exchange>; revoke: Mock<Revoke> }

  beforeEach(() => {
    localStorage.clear()
    sessions = new SessionStore(new SafeStorage(localStorage))
    auth = { launcher: vi.fn<Exchange>(async () => session(2)), revoke: vi.fn<Revoke>(async () => undefined) }
    window.history.replaceState(null, '', '/')
  })

  const visit = (url: string, state: unknown = null) => window.history.replaceState(state, '', url)
  const launcher = (locks?: Pick<LockManager, 'request'>, timeoutMs?: number) =>
    new LauncherLogin(auth, sessions, locks, timeoutMs)

  it('sem passe na URL não pede nada', async () => {
    visit('/acervo')
    const login = launcher()
    await login.start(window)

    expect(auth.launcher).not.toHaveBeenCalled()
    expect(login.outcome).toBe('none')
  })

  it('deixa em paz um fragmento que não é o passe', async () => {
    visit('/#conteudo')
    await launcher().start(window)

    expect(window.location.hash).toBe('#conteudo')
    expect(auth.launcher).not.toHaveBeenCalled()
  })

  it('tira o passe da URL na hora, mantendo caminho, busca e history.state', () => {
    visit('/acervo?q=farol#entrar=passe-1', { key: 'k1' })
    void launcher().start(window)

    // Síncrono: o roteador é criado logo depois e não pode ver o passe.
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/acervo?q=farol')
    expect(window.history.state).toEqual({ key: 'k1' })
    expect(auth.launcher).toHaveBeenCalledTimes(1)
    expect(auth.launcher.mock.calls[0]![0]).toBe('passe-1')
  })

  it('adota a sessão do passe e aposenta a anterior no servidor', async () => {
    sessions.set(session(1))
    visit('/#entrar=passe-1')
    const login = launcher()
    await login.start(window)

    expect(login.outcome).toBe('ok')
    expect(sessions.session?.refreshToken).toBe('refresh-2')
    expect(sessions.endedBy).toBeNull()
    expect(auth.revoke).toHaveBeenCalledExactlyOnceWith('refresh-1')
  })

  it('sessão anterior de outra conta: adota o passe, mas não encerra a sessão alheia', async () => {
    sessions.set(session(1, 'outra-conta'))
    visit('/#entrar=passe-1')
    await launcher().start(window)

    expect(sessions.session?.userId).toBe('u')
    expect(auth.revoke).not.toHaveBeenCalled()
  })

  it('o aviso de falha vale só para a chegada: some quando a sessão muda', async () => {
    auth.launcher.mockResolvedValueOnce(null)
    visit('/#entrar=vencido')
    const login = launcher()
    await login.start(window)
    expect(login.outcome).toBe('rejected')

    sessions.set(session(5))
    expect(login.outcome).toBe('none')
  })

  it('sem sessão anterior, não aposenta nada', async () => {
    visit('/#entrar=passe-1')
    await launcher().start(window)

    expect(sessions.session?.refreshToken).toBe('refresh-2')
    expect(auth.revoke).not.toHaveBeenCalled()
  })

  it('passe recusado mantém a sessão que havia', async () => {
    sessions.set(session(1))
    auth.launcher.mockResolvedValueOnce(null)
    visit('/#entrar=vencido')
    const login = launcher()
    await login.start(window)

    expect(login.outcome).toBe('rejected')
    expect(sessions.session?.refreshToken).toBe('refresh-1')
    expect(auth.revoke).not.toHaveBeenCalled()
  })

  it('servidor fora do ar ou lento demais: resolve mesmo assim, sem mexer na sessão', async () => {
    sessions.set(session(1))
    auth.launcher.mockImplementationOnce(
      (_ticket, signal) => new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason))),
    )
    visit('/#entrar=passe-1')
    const login = launcher(undefined, 5)
    await login.start(window)

    expect(login.outcome).toBe('offline')
    expect(sessions.session?.refreshToken).toBe('refresh-1')
  })

  it('troca dentro do lock da renovação e lê a sessão anterior lá dentro', async () => {
    sessions.set(session(1))
    const locks = {
      request: vi.fn(async (_name: string, _options: LockOptions, task: () => Promise<unknown>) => {
        // Outra janela renova enquanto esta espera o lock.
        localStorage.setItem(SessionStore.KEY, JSON.stringify(session(9)))
        return task()
      }),
    } as unknown as Pick<LockManager, 'request'>
    visit('/#entrar=passe-1')
    await launcher(locks).start(window)

    const [name, options] = (locks.request as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(name).toBe(SESSION_LOCK)
    // O mesmo prazo vale para a espera pelo lock: renovação lenta em outra janela não trava esta.
    expect((options as LockOptions).signal).toBeInstanceOf(AbortSignal)
    // Aposenta a que estava gravada quando o lock chegou, e não a que havia antes dele.
    expect(auth.revoke).toHaveBeenCalledExactlyOnceWith('refresh-9')
  })
})
