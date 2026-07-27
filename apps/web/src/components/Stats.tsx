import { useState } from 'react';
import { formatPercent, formatRuntime, formatTotalTime, formatWatchedAt } from '@reprise/shared';
import { useCalendar, useStatsOverview } from '../api/queries';
import { BarChart } from './BarChart';
import { CalendarHeatmap } from './CalendarHeatmap';
import { QueryState } from './QueryState';
import './Stats.css';

/**
 * Painel de estatísticas, em duas zonas — e a divisão é a ideia central da tela.
 *
 * <b>"No total" conta tudo.</b> Quantos episódios, quantas séries, quanto tempo: nenhuma dessas
 * perguntas depende de QUANDO aconteceu, então nenhuma delas tem motivo para descartar evento.
 * Esta tela já respondeu "60 exibições em 10 séries" para quem tem 10.451 em 115, porque tratava
 * "a data é duvidosa" como "o evento não conta".
 *
 * <b>"Ao longo do tempo" recorta.</b> Aqui a data é o eixo, e 9.995 das exibições importadas
 * carregam a data do lote — todas em 29/12/2025. Incluí-las desenharia um pico que nunca houve.
 * Por isso o filtro mora DENTRO desta seção: ele afeta só o que está abaixo dele, e a posição na
 * página é a única explicação de escopo que ninguém precisa ler para entender.
 *
 * <b>Deixou de ser uma página.</b> Ficava numa aba própria, e a divisão entre "Perfil" e
 * "Estatísticas" cortava ao meio uma coisa só: o que o Reprise sabe sobre você. Quem abria o
 * perfil via quatro contagens de acervo e um botão de exportar, e tinha de trocar de aba para
 * ver quanto tempo isso dá. O app sempre teve as duas coisas na mesma aba; o web é que divergia.
 */
export function Stats() {
  const [includeBackfill, setIncludeBackfill] = useState(false);
  const overview = useStatsOverview(includeBackfill);
  const [year, setYear] = useState<number | null>(null);

  return (
    <>
      <QueryState query={overview}>
        {(data) => {
          const anoAtivo = year ?? data.availableYears[0] ?? new Date().getFullYear();
          const naLinhaDoTempo = data.byYear.reduce((soma, b) => soma + b.exhibitions, 0);
          const temLinhaDoTempo = naLinhaDoTempo > 0;

          return (
            <>
              <section aria-labelledby="total-h">
                <h2 className="section-head" id="total-h">
                  No total
                </h2>

                <div className="tiles">
                  <Tile label="Tempo assistido" value={formatTotalTime(data.summary.totalSeconds)} />
                  <Tile
                    label="Exibições"
                    value={data.summary.exhibitions.toLocaleString('pt-BR')}
                  />
                  <Tile
                    label="Episódios distintos"
                    value={data.summary.distinctEpisodes.toLocaleString('pt-BR')}
                    hint="sem contar as revisitas"
                  />
                  {/*
                    "assistidas", não só "Séries". Este número conta as séries com pelo menos uma
                    exibição; o acervo, logo acima na mesma página, conta as acompanhadas. São 115
                    e 116, e dois rótulos iguais com valores diferentes na mesma tela parecem erro.
                  */}
                  <Tile label="Séries assistidas" value={String(data.summary.seriesCount)} />
                  <Tile
                    label="Taxa de rewatch"
                    value={formatPercent(data.summary.rewatchRate)}
                    hint="quanto das exibições foi revisita"
                  />
                </div>

                <p className="period">
                  Do primeiro registro, {formatWatchedAt(data.summary.firstWatchedAt)}, ao mais
                  recente, {formatWatchedAt(data.summary.lastWatchedAt)}.
                </p>

                <hr className="divider" />

                <BarChart
                  title="Séries por tempo assistido"
                  orientation="horizontal"
                  bars={data.topSeries.map((s) => ({
                    key: String(s.seriesId),
                    label: s.name,
                    value: s.seconds,
                    detail: `${s.name}: ${formatRuntime(s.seconds)} · ${s.exhibitions} exibições em ${s.distinctEpisodes} episódios`,
                  }))}
                  format={(v) => formatTotalTime(v)}
                />
              </section>

              <hr className="divider" />

              <section aria-labelledby="tempo-h">
                <h2 className="section-head" id="tempo-h">
                  Ao longo do tempo
                </h2>

                {/* O aviso vem antes do filtro porque explica por que o filtro existe. */}
                {data.summary.backfillExhibitions > 0 ? (
                  <p className="notice" role="status">
                    <strong className="tabular">
                      {data.summary.backfillExhibitions.toLocaleString('pt-BR')}
                    </strong>{' '}
                    das suas exibições vieram de marcação em massa no TV Time e carregam a data do
                    lote, não a da exibição. Elas <strong>contam nos totais acima</strong>, mas
                    ficam fora dos gráficos abaixo: colocá-las no eixo diria que você assistiu quase
                    tudo num dia só.
                  </p>
                ) : null}

                <div className="filters">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={includeBackfill}
                      onChange={(e) => setIncludeBackfill(e.target.checked)}
                    />
                    <span>Mostrar as marcações em massa nos gráficos</span>
                  </label>
                  <p className="filters__hint">
                    Afeta só esta seção. Ligado, o gráfico ganha um pico artificial na data da
                    importação — útil para conferir, enganoso para ler.
                  </p>
                </div>

                {temLinhaDoTempo ? (
                  <>
                    <div className="tiles">
                      <Tile
                        label="Exibições datadas"
                        value={naLinhaDoTempo.toLocaleString('pt-BR')}
                        hint="as que entram nos gráficos"
                      />
                      <Tile
                        label="Maior sequência"
                        value={`${data.streaks.longestDays} d`}
                        hint={
                          data.streaks.currentDays > 0
                            ? `atual: ${data.streaks.currentDays} d`
                            : 'sem sequência ativa'
                        }
                      />
                    </div>

                    <div className="charts">
                      <BarChart
                        title="Tempo assistido por ano"
                        orientation="vertical"
                        bars={data.byYear.map((b) => ({
                          key: b.label,
                          label: b.label,
                          value: b.seconds,
                          detail: `${b.label}: ${formatRuntime(b.seconds)} em ${b.exhibitions} exibições`,
                        }))}
                        format={(v) => formatTotalTime(v)}
                      />

                      <BarChart
                        title="Exibições por mês"
                        orientation="vertical"
                        bars={data.byMonth.map((b) => ({
                          key: b.label,
                          label: b.label.slice(2),
                          value: b.exhibitions,
                          detail: `${b.label}: ${b.exhibitions} exibições · ${formatRuntime(b.seconds)}`,
                        }))}
                        format={(v) => String(v)}
                      />
                    </div>

                    <hr className="divider" />

                    <section aria-label="Calendário">
                      <div className="year-picker">
                        <span className="eyebrow">Ano</span>
                        {data.availableYears.map((y) => (
                          <button
                            key={y}
                            type="button"
                            className="btn btn--quiet"
                            aria-pressed={y === anoAtivo}
                            data-active={y === anoAtivo}
                            onClick={() => setYear(y)}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                      <CalendarSection year={anoAtivo} includeBackfill={includeBackfill} />
                    </section>
                  </>
                ) : (
                  <p className="state">
                    Nenhuma exibição com data confiável ainda. Conforme você for marcando episódios
                    pelo Reprise, os gráficos se preenchem sozinhos.
                  </p>
                )}
              </section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="tile">
      <p className="tile__label">{label}</p>
      {/* Figura proporcional, não tabular: em corpo grande, dígitos de largura fixa ficam frouxos. */}
      <p className="tile__value">{value}</p>
      {hint ? <p className="tile__hint">{hint}</p> : null}
    </div>
  );
}

function CalendarSection({ year, includeBackfill }: { year: number; includeBackfill: boolean }) {
  const query = useCalendar(year, includeBackfill);
  return (
    <QueryState query={query}>{(days) => <CalendarHeatmap year={year} days={days} />}</QueryState>
  );
}
