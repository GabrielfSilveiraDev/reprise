import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * A API não habilita CORS, e não precisa: o navegador fala só com o Vite, e o Vite repassa
 * `/api/*` para ela. Assim a sessão nunca cruza origem, e trocar o endereço da API é trocar
 * uma variável de ambiente — nenhuma URL absoluta mora no código do cliente.
 */
const apiTarget = process.env.REPRISE_API_URL ?? 'http://localhost:5156'

const apiProxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Porta fixa, sem plano B: o launcher do Windows e o README apontam para a 5173.
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // "Hoje" e "amanhã" dependem do fuso. Os testes fixam o de quem usa o app.
    env: { TZ: 'America/Sao_Paulo' },
  },
})
