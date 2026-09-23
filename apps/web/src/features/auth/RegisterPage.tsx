import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { ApiError } from '@/api/ApiError'
import { api } from '@/api/RepriseApi'
import { Button } from '@/ui/Button'
import { Field } from './Field'

export function RegisterPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [userName, setUserName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const register = useMutation({
    mutationFn: () =>
      api.auth.register({ displayName: displayName.trim(), userName: userName.trim() || null, email: email.trim(), password }),
    onSuccess: (result) => void navigate({ to: '/confirmar', search: { email: result.email, enviado: result.emailSent } }),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    register.mutate()
  }

  const error = register.error instanceof ApiError ? register.error : null
  const closed = error?.status === 403
  const passwordError = error?.fieldErrors.password?.[0] ?? null
  const general = closed ? null : passwordError ? null : (register.error?.message ?? null)

  return (
    <div className="animate-rise">
      <h1 className="headline text-5xl">Criar conta</h1>
      <p className="mt-2 text-ink-2">Um código de seis dígitos confirma o e-mail.</p>

      {closed ? (
        <div role="alert" className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold">O cadastro está fechado neste servidor.</p>
          <p className="mt-1 text-ink-3">Quem administra o Reprise define isso em Jwt__AllowRegistration. Numa API exposta, cadastro aberto é porta aberta.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="Como quer ser chamado" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />
          <Field label="Nome de usuário" hint="Opcional. Dá para entrar com ele no lugar do e-mail." autoComplete="username" autoCapitalize="none" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field label="Senha" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={passwordError} required />
          {general && (
            <p role="alert" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-ink">
              {general}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={register.isPending} disabled={!displayName.trim() || !email.trim() || !password}>
            Criar conta
          </Button>
        </form>
      )}

      <p className="mt-8 text-sm text-ink-3">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-medium text-accent-ink hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
