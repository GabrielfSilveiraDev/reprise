import * as SecureStore from 'expo-secure-store';
import { createRepriseClient } from '@reprise/shared';
import type { RepriseClient } from '@reprise/shared';
import { Auth } from './auth';
import { AuthSession } from './session';
import { LocalStore } from '@/offline/local-store';

const API_URL_SETTING = 'apiUrl';
const ACCESS_TOKEN_KEY = 'reprise.accessToken';

/**
 * O endereço da API.
 *
 * O celular não enxerga o `localhost` do PC, então precisa do IP da máquina na rede — e esse IP
 * muda de casa para escritório, e vira um endereço de túnel quando você está fora. Por isso o
 * endereço é **configurável em tempo de execução** (guardado no SQLite pela tela de ajustes) em
 * vez de assado no bundle: trocar de rede não pode exigir recompilar o app.
 * `EXPO_PUBLIC_API_URL` continua servindo de valor inicial.
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
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // Endereço de túnel é sempre HTTPS; IP de rede local, não.
    return `${/^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(trimmed) ? 'http' : 'https'}://${trimmed}`;
  }
}

/**
 * O token do cadeado de acesso da API — exigido só quando ela está exposta fora da LAN.
 *
 * Mora no **cofre do sistema** (Keystore no Android), não no SQLite junto com o cache. É um
 * segredo: ele não pertence ao mesmo lugar que a lista de séries, e o dia em que a autenticação
 * de verdade chegar, é aqui que o refresh token vai morar também.
 */
export class AccessToken {
  /**
   * Valor inicial vindo do ambiente, para sessões de teste em que o túnel já sobe com um token
   * conhecido — digitar 64 caracteres hexadecimais numa tela de celular é um convite ao erro.
   *
   * Só faz sentido em desenvolvimento: `EXPO_PUBLIC_*` é embutido no bundle, e o bundle é
   * servido pelo mesmo túnel que a API. Um token guardado no cofre sempre tem precedência.
   */
  private static readonly fromEnvironment = process.env.EXPO_PUBLIC_API_TOKEN ?? null;

  static async read(): Promise<string | null> {
    try {
      const stored = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (stored) return stored;
    } catch {
      // Cofre indisponível (aparelho sem tela de bloqueio, por exemplo): seguir para o
      // valor de ambiente é melhor do que derrubar o app.
    }
    return AccessToken.fromEnvironment;
  }

  static async write(token: string): Promise<void> {
    const trimmed = token.trim();
    if (trimmed) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, trimmed);
    else await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }

  static async has(): Promise<boolean> {
    return (await AccessToken.read()) !== null;
  }
}

/**
 * O cliente da API, já autenticado.
 *
 * Renova o token **antes** de usá-lo quando ele está por vencer, em vez de esperar o 401 e
 * repetir a requisição. Numa fila de sincronização isso importa: a alternativa duplicaria cada
 * envio no momento em que o token expira, e envio duplicado é justamente o que a chave de
 * idempotência existe para tolerar — melhor não gerar.
 */
export async function openClient(): Promise<RepriseClient> {
  const [baseUrl, gateToken] = await Promise.all([ApiEndpoint.read(), AccessToken.read()]);

  let session = await AuthSession.read();
  if (session && AuthSession.isExpired(session)) {
    session = await Auth.refresh();
  }

  return createRepriseClient(baseUrl, { gateToken, bearerToken: session?.accessToken });
}
