import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Onde os segredos do app moram: a sessão e o token do cadeado da API.
 *
 * <b>No Android é o Keystore</b>, via `expo-secure-store` — cifrado pelo sistema, fora do alcance
 * de outros aplicativos, que é onde um refresh token tem de estar.
 *
 * <b>No navegador é o `localStorage`</b>, porque o `expo-secure-store` simplesmente não existe
 * ali: chamar `setItemAsync` estoura com "setValueWithKeyAsync is not a function", e o app morre
 * no login. O alvo web existe para conferir as telas do app num PC sem aparelho na mão — e a
 * garantia que um navegador oferece é essa. Não é uma queda de padrão inventada aqui: é
 * exatamente onde o cliente web do Reprise já guarda a sessão dele.
 *
 * Existir como classe, e não como três `if (Platform.OS === 'web')` espalhados, é o ponto: a
 * decisão sobre onde um segredo mora é uma só, e ela fica escrita num lugar só.
 */
export class Vault {
  static async read(key: string): Promise<string | null> {
    if (Vault.isWeb) return Vault.browserStorage?.getItem(key) ?? null;

    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // Cofre indisponível (aparelho sem tela de bloqueio, por exemplo): quem chama decide o
      // que fazer com a ausência. Derrubar o app não é opção.
      return null;
    }
  }

  static async write(key: string, value: string): Promise<void> {
    if (Vault.isWeb) {
      Vault.browserStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  }

  static async clear(key: string): Promise<void> {
    if (Vault.isWeb) {
      Vault.browserStorage?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  }

  private static get isWeb(): boolean {
    return Platform.OS === 'web';
  }

  /**
   * O `localStorage`, quando existe.
   *
   * A renderização estática do Expo Router roda em Node, onde não há `window` — e um acesso
   * solto derrubaria a construção da página antes de o navegador ver qualquer coisa.
   */
  private static get browserStorage(): Storage | null {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }
}
