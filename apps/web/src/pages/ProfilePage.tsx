import { useState } from 'react';
import { formatWhen } from '@reprise/shared';
import { useProfile } from '../api/queries';
import { downloadExport } from '../api/export';
import { QueryState } from '../components/QueryState';
import { Stats } from '../components/Stats';
import './ProfilePage.css';

/**
 * Perfil: tudo o que o Reprise sabe sobre você.
 *
 * <b>As estatísticas moram aqui agora.</b> Havia duas abas — "Perfil", com quatro contagens de
 * acervo e um botão de exportar, e "Estatísticas", com o resto — e a divisão não correspondia a
 * nenhuma pergunta real: "quantas séries eu acompanho" e "quanto tempo isso deu" são a mesma
 * curiosidade separada por um clique. O app nunca teve essa divisão; era o web que divergia.
 *
 * A ordem vai do que te identifica ao que se deduz de você: quem é a conta, o tamanho do acervo,
 * o que os números dizem, e por fim a porta de saída — os dados para levar embora.
 */
export function ProfilePage() {
  const profile = useProfile();

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
                {/*
                  "No Reprise desde ontem" virava "desde há 3 dias": `formatWhen` já responde
                  em linguagem relativa, e a preposição da frase colidia com a da resposta.
                */}
                <p className="profile__since">
                  Conta criada {formatWhen(p.memberSince)}
                  {p.lastImportedAt ? ` · importado ${formatWhen(p.lastImportedAt)}` : ''}
                </p>
              </div>
            </section>

            <section aria-labelledby="acervo-h">
              <h2 className="section-head" id="acervo-h">
                Seu acervo
              </h2>
              <div className="profile__facts">
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
              </div>
            </section>

            <hr className="divider" />

            <Stats />

            <hr className="divider" />

            <Export />
          </div>
        )}
      </QueryState>
    </>
  );
}

/**
 * Levar os dados embora.
 *
 * Componente próprio para o estado do download não redesenhar a página inteira — acima dele há
 * dois gráficos e um calendário de 365 células.
 */
function Export() {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const exportar = async () => {
    setExporting(true);
    setResult(null);
    try {
      const summary = await downloadExport();
      setResult(`${summary.watchEvents.toLocaleString('pt-BR')} exibições em ${summary.fileName}.`);
    } catch (cause) {
      setResult(cause instanceof Error ? cause.message : 'Não deu para exportar.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="profile__export" aria-labelledby="dados-h">
      <h2 className="section-head" id="dados-h">
        Seus dados
      </h2>
      <p className="profile__hint">
        Baixa tudo em JSON — perfil, séries e cada exibição com data e origem. É o que o TV Time
        não fez.
      </p>
      <button type="button" className="btn btn--primary" onClick={exportar} disabled={exporting}>
        {exporting ? 'Preparando…' : 'Exportar meus dados'}
      </button>
      {result ? (
        <p className="profile__hint" role="status">
          {result}
        </p>
      ) : null}
    </section>
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
