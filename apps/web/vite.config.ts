import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:5156';

// Quando a API está com o cadeado de acesso ligado (`Api:AccessToken`), ela exige o token de
// todo mundo — inclusive de quem chama do localhost, porque é justamente pelo loopback que um
// túnel entra. O proxy injeta o cabeçalho para o cliente web não precisar saber disso.
const API_TOKEN = process.env.VITE_API_TOKEN;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
