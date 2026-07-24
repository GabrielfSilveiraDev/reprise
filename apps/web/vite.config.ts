import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:5156';

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
      },
    },
  },
});
