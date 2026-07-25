import { useId, useState } from 'react';
import './BarChart.css';

export interface Bar {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Texto do tooltip e do rótulo acessível — sempre traz o valor por extenso. */
  readonly detail: string;
}

interface Props {
  bars: readonly Bar[];
  title: string;
  /** Formata o valor do eixo e do rótulo direto. */
  format: (value: number) => string;
  /** Horizontal quando os rótulos são nomes longos (top séries); vertical para tempo. */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Gráfico de barras de UMA série. Uma cor só para todas as barras — colorir por
 * tamanho seria duplicar o comprimento num canal que não acrescenta informação.
 *
 * O tooltip é reforço, nunca o único caminho: o valor extremo é rotulado direto e
 * a tabela equivalente fica ao lado, atrás de um `<details>`.
 */
export function BarChart({ bars, title, format, orientation = 'vertical' }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const tableId = useId();

  const max = Math.max(...bars.map((b) => b.value), 1);
  const peak = bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0]);

  return (
    <figure className="chart">
      <figcaption className="chart__title">{title}</figcaption>

      <div className={`chart__plot chart__plot--${orientation}`} role="img" aria-label={title}>
        {bars.map((bar) => {
          const ratio = bar.value / max;
          const isPeak = peak && bar.key === peak.key;
          return (
            <div
              key={bar.key}
              className="chart__slot"
              onMouseEnter={() => setHovered(bar.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="chart__bar" style={{ '--ratio': `${ratio * 100}%` } as React.CSSProperties}>
                <span className="chart__fill" />
              </div>
              <span className="chart__label tabular">{bar.label}</span>

              {/* Rótulo direto só no extremo — número em toda barra vira ruído e não é lido. */}
              {isPeak && orientation === 'vertical' ? (
                <span className="chart__peak tabular">{format(bar.value)}</span>
              ) : null}
              {orientation === 'horizontal' ? (
                <span className="chart__value tabular">{format(bar.value)}</span>
              ) : null}

              {hovered === bar.key ? (
                <span className="chart__tip" role="tooltip">
                  {bar.detail}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <details className="chart__table">
        <summary>Ver como tabela</summary>
        <table id={tableId}>
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row">{bar.label}</th>
                <td className="tabular">{format(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
