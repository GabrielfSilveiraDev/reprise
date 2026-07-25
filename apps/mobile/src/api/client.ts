import { createRepriseClient } from '@reprise/shared';
import type { RepriseClient } from '@reprise/shared';
import { LocalStore } from '@/offline/local-store';

const API_URL_SETTING = 'apiUrl';

/**
 * O endereço da API.
 *
 * O celular não enxerga o `localhost` do PC, então precisa do IP da máquina na rede — e esse IP
 * muda de casa para escritório. Por isso o endereço é **configurável em tempo de execução**
 * (guardado no SQLite pela tela de ajustes) em vez de assado no bundle: trocar de rede não pode
 * exigir recompilar o app. `EXPO_PUBLIC_API_URL` continua servindo de valor inicial.
 */
export class ApiEndpoint {
  static readonly fallback = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5156';

  static async read(): Promise<string> {
    const store = await LocalStore.open();
    return (await store.getSetting(API_URL_SETTING)) ?? ApiEndpoint.fallback;
  }

  static async write(url: string): Promise<void> {
    const store = await LocalStore.open();
    await store.setSetting(API_URL_SETTING, ApiEndpoint.normalize(url));
  }

  /** Tolera o que se digita num celular: espaços, barra final, esquema faltando. */
  static normalize(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, '');
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  }
}

export async function openClient(): Promise<RepriseClient> {
  return createRepriseClient(await ApiEndpoint.read());
}
