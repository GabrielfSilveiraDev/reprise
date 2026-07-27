import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:5156';

// Quando a API está com o cadeado de acesso ligado (`Api:AccessToken`), ela exige o token de
// todo mundo — inclusive de quem chama do localhost, porque é justamente pelo loopback que um
// túnel entra. O proxy injeta o cabeçalho para o cliente web não precisar saber disso.
const API_TOKEN = process.env.VITE_API_TOKEN;

/*
 * Hosts extras aceitos pelo servidor de desenvolvimento, separados por vírgula.
 *
 * O Vite recusa requisição cujo cabeçalho `Host` ele não reconhece — é a defesa contra DNS
 * rebinding, em que uma página de fora resolve um domínio para 127.0.0.1 e passa a falar com o
 * seu servidor local. Um túnel chega justamente assim: com o Host do túnel, não `localhost`.
 *
 * Por isso é variável de ambiente e não uma lista fixa no repositório: liberar `.trycloudflare.com`
 * para todo mundo que roda `pnpm dev` seria afrouxar o padrão de quem nunca vai usar túnel. Quem
 * precisa, declara na hora:
 *
 *   VITE_ALLOWED_HOSTS=algo.trycloudflare.com pnpm dev
 */
const ALLOWED_HOSTS = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],

  /*
   * Uma cópia só de React, custe o que custar.
   *
   * O app Android exige React 19.1.0 (é o que o Expo SDK 54 traz) e o web usa 19.2. Com
   * `nodeLinker: hoisted` — necessário para o Metro resolver o pacote de entrada — a raiz do
   * monorepo ficou com a versão do celular, e `apps/web` com a sua. Resultado: as dependências
   * içadas (react-query, react-router) resolvem um React e o código do app resolve outro, e dois
   * Reacts no mesmo processo quebram todo hook — "Invalid hook call", tela em branco.
   *
   * `dedupe` força todos os `import 'react'` a caírem na mesma instância. Alinhar as versões
   * seria a outra saída, mas rebaixaria o web por uma restrição que é do Expo.
   */
  resolve: { dedupe: ['react', 'react-dom'] },

  server: {
    port: 5173,
    ...(ALLOWED_HOSTS.length > 0 ? { allowedHosts: ALLOWED_HOSTS } : {}),
    // Proxy em vez de CORS na API: em desenvolvimento o front fala com a própria origem,
    // então não há preflight nem configuração de CORS para manter em sincronia.
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        ...(API_TOKEN ? { headers: { 'X-Reprise-Token': API_TOKEN } } : {}),
      },
    },
  },
});
