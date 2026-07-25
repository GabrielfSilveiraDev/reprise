import { useEffect, useRef } from 'react';
import * as Network from 'expo-network';
import { useFlush, usePendingActions } from '@/api/queries';

export interface SyncStatus {
  readonly online: boolean;
  readonly pending: number;
  readonly syncing: boolean;
  readonly flushNow: () => void;
}

/**
 * Esvazia a fila quando a rede volta.
 *
 * Dispara na **transição** offline→online, não a cada leitura do estado da rede: no Android o
 * evento de conectividade repica várias vezes ao trocar de wi-fi para dados, e uma sincronização
 * por repique gastaria bateria à toa. A entrega é idempotente, então repetir não corromperia
 * nada — mas "não corrompe" não é razão para fazer.
 */
export function useAutoSync(): SyncStatus {
  const network = Network.useNetworkState();
  const pending = usePendingActions();
  const flush = useFlush();

  const online = network.isInternetReachable ?? network.isConnected ?? false;
  const wasOnline = useRef(online);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    const reconnected = online && !wasOnline.current;
    wasOnline.current = online;
    if (reconnected) flushRef.current.mutate();
  }, [online]);

  return {
    online,
    pending: pending.data?.length ?? 0,
    syncing: flush.isPending,
    flushNow: () => flush.mutate(),
  };
}
