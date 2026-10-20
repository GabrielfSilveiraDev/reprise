import { expect, type Page, test } from '@playwright/test'
import { MockApi, NOW } from './mock-api'

/**
 * O app instalável: o manifesto e o service worker que o navegador exige para oferecer "Instalar",
 * e o modo app — instalado (PWA ou o APK do Android), o Reprise é sempre Brasa.
 *
 * Os outros testes rodam com o service worker bloqueado (playwright.config.ts), para a API
 * simulada responder sem intermediário; aqui ele é o assunto.
 */
test.use({ serviceWorkers: 'allow' })

async function open(page: Page, path: string, { installed = false, design }: { installed?: boolean; design?: string } = {}) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await new MockApi().install(page)
  await page.clock.setFixedTime(NOW)
  await page.addInitScript(
    ({ session, installed, design }) => {
      localStorage.setItem('reprise.session', JSON.stringify(session))
      if (design) localStorage.setItem('reprise.design', design)
      // O Playwright não emula `display-mode`; quem pergunta por ele (o script do index.html e o
      // AppMode) recebe a resposta de um app instalado. (Roda no navegador; os tipos do e2e são os
      // do Node, daí a forma mínima declarada aqui.)
      if (installed) {
        type Query = { matches: boolean; media: string }
        const win = globalThis as unknown as { matchMedia: (query: string) => Query }
        const original = win.matchMedia.bind(win)
        win.matchMedia = (query) => (query === '(display-mode: standalone)' ? { ...original(query), matches: true, media: query } : original(query))
      }
    },
    { session: MockApi.session(), installed, design },
  )
  await page.goto(path)
  return errors
}

test('o site é instalável: manifesto do app e service worker no ar', async ({ page }) => {
  const errors = await open(page, '/')
  await expect(page.getByRole('heading', { name: 'Boa noite, Gabriel.' })).toBeVisible()

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await page.request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'Reprise', display: 'standalone', start_url: '/' })
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)

  const worker = await page.evaluate(async () => {
    type Workers = { serviceWorker: { ready: Promise<{ active: { scriptURL: string } | null }> } }
    return (await (navigator as unknown as Workers).serviceWorker.ready).active?.scriptURL
  })
  expect(worker).toMatch(/\/sw\.js$/)
  expect(errors).toEqual([])
})

test('instalado, o app é sempre Brasa e Conta não oferece a troca de design', async ({ page }) => {
  // A escolha do navegador era Grade; no app, não vale.
  const errors = await open(page, '/conta', { installed: true, design: 'grade' })
  await expect(page.getByRole('heading', { name: 'Conta e dados' })).toBeVisible()

  await expect(page.locator('html')).toHaveAttribute('data-design', 'brasa')
  await expect(page.getByText('O app usa sempre o design')).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Design' })).toHaveCount(0)
  // E a escolha do navegador continua guardada para quando o Reprise for aberto nele.
  expect(await page.evaluate(() => localStorage.getItem('reprise.design'))).toBe('grade')
  expect(errors).toEqual([])
})

test('no navegador, a escolha de design continua valendo', async ({ page }) => {
  const errors = await open(page, '/conta', { design: 'grade' })
  await expect(page.getByRole('heading', { name: 'Conta e dados' })).toBeVisible()

  await expect(page.locator('html')).toHaveAttribute('data-design', 'grade')
  await expect(page.getByRole('radiogroup', { name: 'Design' })).toBeVisible()
  expect(errors).toEqual([])
})
