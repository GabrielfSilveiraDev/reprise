import { useState } from 'react';
import { formatWatchedAt } from '@reprise/shared';
import { useProfile } from '../api/queries';
import { downloadExport } from '../api/export';
import { QueryState } from '../components/QueryState';
import './ProfilePage.css';

/**
 * Perfil: quem é o dono dos dados e o tamanho do acervo dele.
 *
 * Separado de Estatísticas, ao contrário do app, e de propósito. No celular as duas coisas
 * cabem numa rolagem só porque a tela é estreita e a leitura é sequencial; aqui há espaço para
 * uma página inteira de gráficos, e misturá-la com identidade e export faria a página responder
 * a duas perguntas ao mesmo tempo.
 */
export function ProfilePage() {
  const profile = useProfile();
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const exportar = async () => {
    setExporting(true);
    setResult(null);
    try {
      const summary = await downloadExport();
      setResult(
        `${summary.watchEvents.toLocaleString('pt-BR')} exibições em ${summary.fileName}.`,
      );
    } catch (cause) {
      setResult(cause instanceof Error ? cause.message : 'Não deu para exportar.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Perfil</p>
        <h1>Sua conta</h1>
      </header>

      <QueryState query={profile}>
        {(p) => (
          <div className="profile">
            <section className="profile__identity">
              <span className="profile__avatar" aria-hidden="true">
                {p.displayName.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <div>
                <p className="profile__name">{p.displayName}</p>
                <p className="profile__email">{p.email}</p>
                <p className="profile__since">
                  No Reprise desde {formatWatchedAt(p.memberSince)}
                  {p.lastImportedAt ? ` · importado ${formatWatchedAt(p.lastImportedAt)}` : ''}
                </p>
              </div>
            </section>

            <section className="profile__facts" aria-label="Acervo">
              <Fact label="Séries" value={p.seriesTracked} />
              <Fact label="Acompanhando" value={p.seriesFollowing} />
              <Fact label="Concluídas" value={p.seriesFinished} />
              <Fact label="Arquivadas" value={p.seriesArchived} />
              <Fact label="Episódios no catálogo" value={p.catalogEpisodes} />
              {p.seriesWithoutMetadata > 0 ? (
                <Fact
                  label="Sem metadados"
                  value={p.seriesWithoutMetadata}
                  hint="o progresso destas é estimativa"
                />
              ) : null}
            </section>

            <section className="profile__export">
              <h2 className="profile__section-title">Seus dados</h2>
              <p className="profile__hint">
                Baixa tudo em JSON — perfil, séries e cada exibição com data e origem. É o que o
                TV Time não fez.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={exportar}
                disabled={exporting}
              >
                {exporting ? 'Preparando…' : 'Exportar meus dados'}
              </button>
              {result ? (
                <p className="profile__hint" role="status">
                  {result}
                </p>
              ) : null}
            </section>
          </div>
        )}
      </QueryState>
    </>
  );
}

function Fact({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="fact">
      <p className="fact__label">{label}</p>
      <p className="fact__value tabular">{value.toLocaleString('pt-BR')}</p>
      {hint ? <p className="fact__hint">{hint}</p> : null}
    </div>
  );
}
