import { SessionSummary, formatTotalTime, formatWatchedAt } from '@reprise/shared';
import type { RewatchSession } from '@reprise/shared';
import './RewatchSessions.css';

/**
 * Quantas vezes você percorreu esta série, e quando.
 *
 * A trilha de blocos já diz <i>quanto</i> cada episódio foi revisto; isto diz <i>quando</i> —
 * e é a pergunta que dá nome ao app. As passadas são derivadas do log por silêncio entre
 * exibições, não por ordem de episódio.
 */
export function RewatchSessions({
  sessions,
  backfillExhibitions,
}: {
  sessions: readonly RewatchSession[];
  backfillExhibitions: number;
}) {
  const notice = SessionSummary.hiddenNotice(backfillExhibitions);

  // Sem passada nenhuma e sem nada a declarar, o bloco inteiro não tem o que dizer.
  if (sessions.length === 0 && !notice) return null;

  return (
    <section className="sessions" aria-labelledby="sessions-heading">
      <h2 id="sessions-heading" className="eyebrow">
        Suas passadas
      </h2>

      {sessions.length > 0 ? (
        <ol className="sessions__list">
          {sessions.map((s) => (
            <li key={s.ordinal} className="session">
              <span className="session__ordinal">{SessionSummary.ordinalLabel(s.ordinal)}</span>
              <span className="session__when">
                {formatWatchedAt(s.startedAt)}
                {s.spanDays > 1 ? ` – ${formatWatchedAt(s.endedAt)}` : ''}
              </span>
              <span className="session__detail">{SessionSummary.detail(s)}</span>
              <span className="session__time tabular">{formatTotalTime(s.totalSeconds)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="sessions__empty">
          Nenhuma passada com data confiável ainda. As marcações que você fizer daqui em diante
          aparecem aqui.
        </p>
      )}

      {notice ? <p className="sessions__notice">{notice}</p> : null}
    </section>
  );
}
