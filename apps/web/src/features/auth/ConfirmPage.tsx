import { useMutation } from '@tanstack/react-query'
import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/ApiError'
import { api } from '@/api/RepriseApi'
import { Button } from '@/ui/Button'
import { Field } from './Field'

const route = getRouteApi('/_public/confirmar')

export function ConfirmPage() {
  const search = route.useSearch()
  const router = useRouter()
  const [email, setEmail] = useState(search.email ?? '')
  const [code, setCode] = useState('')

  const confirm = useMutation({
    mutationFn: () => api.auth.confirm(email.trim(), code.trim()),
    onSuccess: () => router.history.push('/'),
  })
  const resend = useMutation({
    mutationFn: () => api.auth.resend(email.trim()),
    // A API responde igual exista a conta ou não, de propósito — a mensagem também.
    onSuccess: () => toast('Se houver uma conta esperando validação, um código novo foi enviado.'),
    onError: (error) => toast.error(error.message),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    confirm.mutate()
  }

  const wrong = confirm.error instanceof ApiError && confirm.error.isUnauthorized

  return (
    <div className="animate-rise">
      <h1 className="headline text-5xl">Validar e-mail</h1>
      <p className="mt-2 text-ink-2">
        {search.enviado === false
          ? 'Este servidor não envia e-mail: o código de seis dígitos está no log da API.'
          : 'Digite o código de seis dígitos que enviamos para você.'}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field
          label="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          error={wrong ? 'Código inválido ou vencido.' : confirm.error && !wrong ? confirm.error.message : null}
          className="code h-14 w-full rounded-control border border-line bg-surface px-3.5 text-center text-2xl tracking-[0.5em] outline-none focus:border-line-strong"
          required
          autoFocus={Boolean(search.email)}
        />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={confirm.isPending} disabled={!email.trim() || code.length !== 6}>
          Validar e entrar
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Button variant="ghost" size="sm" loading={resend.isPending} disabled={!email.trim()} onClick={() => resend.mutate()}>
          Reenviar código
        </Button>
        <Link to="/entrar" className="font-medium text-accent-ink hover:underline">
          Voltar ao login
        </Link>
      </div>
    </div>
  )
}
