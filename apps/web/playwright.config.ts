import { defineConfig, devices } from '@playwright/test'

/**
 * Testes de ponta a ponta contra uma API simulada (e2e/mock-api.ts): o Vite serve o app de
 * verdade e toda chamada a /api é atendida em memória, com relógio fixo e fuso de São Paulo.
 * Não precisa de banco, de API nem de conta.
 *
 * No Windows usa o Edge instalado (nada a baixar). Em outro sistema, rode antes
 * `pnpm exec playwright install chromium`, ou escolha com PLAYWRIGHT_CHANNEL.
 *
 * Roda contra o BUILD de produção (`vite build` + `vite preview`), não contra o servidor de
 * desenvolvimento: é o build que vai para o ar, com a divisão de código e a minificação de
 * verdade. De quebra a suíte fica mais rápida, sem o Vite compilando cada página na primeira visita.
 */
const channel = process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined)
const PORT = 5174

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1440, height: 900 } } },
    { name: 'celular', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
