import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

interface Props<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  emptyWhen?: (data: T) => boolean;
  emptyTitle?: string;
  emptyHint?: string;
}

/**
 * Carregando / erro / vazio num lugar só, com as regiões vivas que o leitor de tela precisa.
 * Sem isso, cada página reinventaria três estados e esqueceria o `aria-live` em dois deles.
 */
export function QueryState<T>({ query, children, emptyWhen, emptyTitle, emptyHint }: Props<T>) {
  if (query.isPending) {
    return (
      <p className="state" role="status" aria-live="polite">
        Carregando…
      </p>
    );
  }

  if (query.isError) {
    return (
      <div className="state state--error" role="alert">
        <p className="state__title">Não foi possível carregar</p>
        <p>{query.error instanceof Error ? query.error.message : 'Erro desconhecido.'}</p>
        <button type="button" className="btn" onClick={() => void query.refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (emptyWhen?.(query.data)) {
    return (
      <div className="state">
        <p className="state__title">{emptyTitle ?? 'Nada por aqui'}</p>
        {emptyHint ? <p>{emptyHint}</p> : null}
      </div>
    );
  }

  return <>{children(query.data)}</>;
}
