import { useMutation, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { KeyRound, WifiOff } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { ApiError } from '@/api/ApiError'
import { api } from '@/api/RepriseApi'
import { Button } from '@/ui/Button'
import { Field, safeRedirect } from './Field'

const route = getRouteApi('/_public/entrar')

export function LoginPage() {
  const { redirect } = route.useSearch()
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [serverKey, setServerKey] = useState(api.serverKey.value ?? '')

  // A raiz da API responde sem login; 401 nela é o cadeado do servidor pedindo a chave.
  const probe = useQuery({ queryKey: ['server-probe'], queryFn: () => api.auth.probe(), staleTime: 0, retry: false })
  const locked = probe.data === 'locked'
  // A janela veio do launcher com um passe, e ele não virou sessão (vencido, já usado, servidor
  // fora do ar). Sem este aviso, o dono — que não sabe a senha — só veria o formulário.
  const launcherFailed = api.launcherLogin.outcome === 'rejected' || api.launcherLogin.outcome === 'offline'

  const login = useMutation({
    mutationFn: async () => {
      if (locked || serverKey) api.serverKey.set(serverKey)
      return api.auth.login(identifier.trim(), password)
    },
    onSuccess: () => router.history.push(safeRedirect(redirect)),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate()
  }

  const error = login.error
  const unconfirmed = error instanceof ApiError && error.status === 403
  const message = !error
    ? null
    : error instanceof ApiError && error.isUnauthorized
      ? locked
        ? 'Não entrou. Confira a chave do servidor, o usuário e a senha.'
        : 'Usuário ou senha incorretos.'
      : error.message

  return (
    <div className="animate-rise">
      <h1 className="headline text-5xl">Entrar</h1>
      <p className="mt-2 text-ink-2">Seu histórico de séries, do jeito que você viu.</p>

      {launcherFailed && (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl bg-surface-2 p-3.5 text-sm">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-ink-3" />
          {locked ? (
            // Com o cadeado ligado, o passe nem chega à API sem a chave — e a chave fica guardada
            // por navegador. Digitada uma vez aqui, as próximas janelas do launcher entram sozinhas.
            <p>
              A entrada automática precisa da chave do servidor. Digite-a abaixo uma vez e use{' '}
              <span className="font-medium">Abrir outra janela</span> no ícone do Reprise na bandeja do Windows.
            </p>
          ) : (
            <p>
              A entrada automática do launcher não funcionou desta vez. Use <span className="font-medium">Abrir outra janela</span> no ícone do
              Reprise na bandeja do Windows — cada janela aberta por ele traz um passe novo.
            </p>
          )}
        </div>
      )}

      {probe.data === 'offline' && (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl bg-surface-2 p-3.5 text-sm">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>
            O servidor do Reprise não respondeu. No Docker, veja <span className="code">docker compose logs api</span>; rodando a API à
            mão, confira se ela está de pé em <span className="code">localhost:5156</span>.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {locked && (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-accent-ink" /> Este servidor está trancado
            </p>
            <Field
              label="Chave do servidor"
              type="password"
              autoComplete="off"
              value={serverKey}
              onChange={(e) => setServerKey(e.target.value)}
              // Guardada ao sair do campo, sem esperar o login: é o que deixa a próxima janela do
              // launcher entrar sozinha, sem a senha (ver o aviso de entrada automática acima).
              onBlur={() => serverKey.trim() && api.serverKey.set(serverKey)}
              hint="A chave de acesso da API (Api__AccessToken). Fica guardada neste navegador."
              required
            />
          </div>
        )}
        <Field
          label="E-mail ou usuário"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoFocus
        />
        <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {message && (
          <div role="alert" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-ink">
            {unconfirmed ? (
              <>
                Falta validar o e-mail.{' '}
                <Link to="/confirmar" search={{ email: identifier.includes('@') ? identifier.trim() : undefined }} className="font-semibold underline">
                  Digitar o código
                </Link>
              </>
            ) : (
              message
            )}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={login.isPending} disabled={!identifier.trim() || !password}>
          Entrar
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-3">
        Ainda não tem conta?{' '}
        <Link to="/criar-conta" className="font-medium text-accent-ink hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
