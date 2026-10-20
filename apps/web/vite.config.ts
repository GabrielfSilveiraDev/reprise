import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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
  plugins: [
    react(),
    tailwindcss(),
    // O app instalável: manifesto, ícones (public/, gerados por `pnpm pwa:icons`) e o service worker
    // que se atualiza sozinho a cada deploy (ver src/lib/AppUpdates.ts). O app é sempre Brasa — ver
    // src/lib/AppMode.ts —, daí as cores fixas da Brasa clara aqui.
    VitePWA({
      registerType: 'autoUpdate',
      // O registro é feito à mão, em AppUpdates, para conferir versão nova quando o app volta à tela.
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Reprise',
        short_name: 'Reprise',
        description: 'Seu diário de séries. Cada exibição conta.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4f0',
        theme_color: '#f6f4f0',
        categories: ['entertainment', 'lifestyle'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // A casca do app. As fontes ficam de fora da pré-carga: são dezenas de arquivos (três
        // designs, cada fonte em vários alfabetos) e o app só usa as da Brasa — vêm sob demanda,
        // e o cache abaixo as guarda depois da primeira vez.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
        // A API e a prova de dono do APK nunca são respondidas pelo worker.
        navigateFallbackDenylist: [/^\/api(\/|$)/, /^\/\.well-known\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fontes', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Porta fixa, sem plano B: os docs de desenvolvimento e do web apontam para a 5173.
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
