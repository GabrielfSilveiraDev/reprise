import { useMutation, useQuery } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
import { Download, KeyRound, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { type ReactNode, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { Queries } from '@/api/queries'
import { api } from '@/api/RepriseApi'
import { initialsOf, useSession } from '@/app/useSession'
import { Fmt } from '@/lib/format'
import { theme, type ThemePreference } from '@/lib/ThemeController'
import { Button } from '@/ui/Button'
import { Segmented } from '@/ui/Controls'
import { ErrorState, Skeleton } from '@/ui/Feedback'
import { ConfirmDialog } from '@/ui/Overlay'
import { cn } from '@/ui/cn'
import { PageHeader } from '@/ui/PageHeader'
import { DesignPicker } from './DesignPicker'

export function AccountPage() {
  const session = useSession()
  const me = useQuery(Queries.me())
  const [confirmLogout, setConfirmLogout] = useState(false)
  const preference = useSyncExternalStore(theme.subscribe, theme.getSnapshot)
  const [serverKey, setServerKey] = useState(api.serverKey.value)

  const exporter = useMutation({
    mutationFn: () => api.account.export(),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob)
      const link = Object.assign(document.createElement('a'), { href: url, download: filename })
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`Baixado: ${filename}`)
    },
    onError: (error) => toast.error(error.message),
  })

  // Só encerra a sessão: a moldura do app percebe e leva para o login, e o cache da pessoa é
  // limpo em main.tsx. Navegar daqui também criaria duas navegações concorrentes.
  const logout = () => void api.auth.logout()

  const name = me.data?.displayName ?? session?.displayName ?? ''

  return (
    <>
      <PageHeader title="Conta e dados" />

      <Card
        title="Aparência"
        description="Três desenhos do mesmo Reprise — os dados e as regras são os mesmos, muda a forma. A escolha vale para este navegador."
        className="mb-6"
      >
        <DesignPicker />
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <span className="text-sm font-medium">Tema</span>
          <Segmented<ThemePreference>
            label="Tema"
            value={preference}
            onChange={(v) => theme.set(v)}
            options={[
              { value: 'system', label: <><Monitor className="size-4" /> Sistema</> },
              { value: 'light', label: <><Sun className="size-4" /> Claro</> },
              { value: 'dark', label: <><Moon className="size-4" /> Escuro</> },
            ]}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Você">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-pill bg-accent-soft text-lg font-semibold text-accent-ink">{initialsOf(name || '?')}</span>
            <div className="min-w-0">
              <p className="headline truncate text-2xl">{name}</p>
              <p className="truncate text-sm text-ink-3">{me.data?.email ?? session?.email}</p>
              {me.data && <p className="text-xs text-ink-3">No Reprise desde {Fmt.pattern(parseISO(me.data.memberSince), "MMMM 'de' yyyy")}</p>}
            </div>
          </div>

          {me.isPending ? (
            <Skeleton className="mt-6 h-28" />
          ) : me.isError ? (
            <ErrorState className="mt-6" error={me.error} onRetry={() => void me.refetch()} />
          ) : (
            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <Fact label="Séries no acervo" value={Fmt.number(me.data.seriesTracked)} />
              <Fact label="Assistindo" value={Fmt.number(me.data.seriesFollowing)} />
              <Fact label="Concluídas" value={Fmt.number(me.data.seriesFinished)} />
              <Fact label="Arquivadas" value={Fmt.number(me.data.seriesArchived)} />
              <Fact label="Episódios no catálogo" value={Fmt.number(me.data.catalogEpisodes)} />
              <Fact label="Sem metadados" value={Fmt.number(me.data.seriesWithoutMetadata)} />
              {me.data.lastImportedAt && <Fact label="Última importação" value={Fmt.day(parseISO(me.data.lastImportedAt))} />}
            </dl>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Seus dados" description="O TV Time fechou levando o histórico de todo mundo. Aqui ele é seu: o arquivo tem cada exibição, com data e origem, endereçada de um jeito que qualquer outro app consegue ler.">
            <Button variant="primary" loading={exporter.isPending} icon={<Download className="size-4" />} onClick={() => exporter.mutate()}>
              Baixar tudo em JSON
            </Button>
          </Card>

          {serverKey && (
            <Card title="Chave do servidor" description="Este navegador guarda a chave de acesso do servidor do Reprise. Ela não é a sua senha — é a porta do prédio.">
              <Button
                variant="outline"
                icon={<KeyRound className="size-4" />}
                onClick={() => {
                  api.serverKey.clear()
                  setServerKey(null)
                  toast('Chave esquecida neste navegador')
                }}
              >
                Esquecer a chave
              </Button>
            </Card>
          )}

          <Card title="Sessão">
            <Button variant="outline" icon={<LogOut className="size-4" />} onClick={() => setConfirmLogout(true)}>
              Sair deste navegador
            </Button>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Sair?"
        description="Você volta para a tela de entrada. Nada do seu histórico é apagado."
        confirmLabel="Sair"
        onConfirm={logout}
        destructive
      />
    </>
  )
}

function Card({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-card border border-line bg-surface p-5 grade:border-line-strong', className)}>
      <h2 className="headline text-xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
