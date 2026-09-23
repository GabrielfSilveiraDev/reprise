import { expect, type Page, test } from '@playwright/test'
import { MockApi, NOW } from './mock-api'

/**
 * Fluxos do Reprise de ponta a ponta. A API é simulada em memória (mock-api.ts) no formato do
 * contrato real; o relógio está parado na quinta, 24/09/2026, 18h em Brasília.
 */

/** Erros não tratados na página reprovam o teste, mesmo que a tela pareça certa. */
const pageErrors = new WeakMap<Page, string[]>()
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

async function open(page: Page, path: string, { loggedIn = true, theme }: { loggedIn?: boolean; theme?: 'light' | 'dark' } = {}) {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', (e) => errors.push(e.message))
  const api = new MockApi()
  await api.install(page)
  await page.clock.setFixedTime(NOW)
  await page.addInitScript(
    ({ session, theme }) => {
      if (session && !localStorage.getItem('reprise.session')) localStorage.setItem('reprise.session', JSON.stringify(session))
      if (theme) localStorage.setItem('reprise.theme', theme)
    },
    { session: loggedIn ? MockApi.session() : null, theme },
  )
  await page.goto(path)
  return api
}

test('sem sessão, vai para o login e volta para onde queria depois de entrar', async ({ page }) => {
  await open(page, '/acervo', { loggedIn: false })
  await expect(page).toHaveURL(/\/entrar\?redirect=/)

  await page.getByLabel('E-mail ou usuário').fill('gabriel')
  await page.getByLabel('Senha', { exact: true }).fill('errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Usuário ou senha incorretos.')

  await page.getByLabel('Senha', { exact: true }).fill('senha-certa')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/acervo$/)
  await expect(page.getByRole('heading', { name: 'Acervo', level: 1 })).toBeVisible()
})

test('Agora: a fila, marcar com um toque e desfazer', async ({ page }) => {
  const api = await open(page, '/')
  await expect(page.getByRole('heading', { name: 'Boa noite, Gabriel.' })).toBeVisible()

  const continuar = page.getByRole('region', { name: 'Continuar' })
  const farol = continuar.locator('article').filter({ hasText: 'Farol do Norte' })
  await expect(farol).toContainText('S03E06')

  await farol.getByRole('button', { name: /Marcar .* como visto/ }).click()
  await expect(page.getByText('Farol do Norte · S03E06 · visto')).toBeVisible()
  await expect(farol).toContainText('S03E07') // a fila avançou

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByText('exibição removida')).toBeVisible()
  expect(api.calls.filter((c) => c.path === '/episodes/1306/watch').map((c) => c.method)).toEqual(['POST', 'DELETE'])

  // Estreias no fuso de quem olha: a de 04h de sexta aparece como "amanhã".
  await expect(page.getByRole('region', { name: 'Saindo em breve' })).toContainText('amanhã · 04:00')
})

test('Acervo: filtro por estado, busca sem acento e sugestão de concluir', async ({ page }) => {
  await open(page, '/acervo')
  // Encerrada e cancelada contam igual: a produção acabou e você viu tudo.
  await expect(page.getByText('2 séries terminaram e você viu tudo.')).toBeVisible()
  await expect(page.getByText(/^Linha Vermelha, Sinal Fraco\./)).toBeVisible()

  await page.getByPlaceholder('Filtrar pelo nome').fill('mare')
  await expect(page.getByRole('link', { name: /Maré Alta/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Farol do Norte/ })).toHaveCount(0)
  await page.getByPlaceholder('Filtrar pelo nome').fill('')

  await page.getByRole('button', { name: 'Mover para Concluídas' }).click()
  await expect(page.getByText('2 séries movidas')).toBeVisible()
  await expect(page.getByText('2 séries terminaram e você viu tudo.')).toHaveCount(0)

  await page.getByRole('radio', { name: /Concluídas/ }).click()
  await expect(page).toHaveURL(/estado=Finished/)
  await expect(page.getByRole('link', { name: /Linha Vermelha/ })).toBeVisible()
})

test('Série: mapa, sinopse protegida, marcar e episódio que ainda não saiu', async ({ page }) => {
  await open(page, '/serie/2')
  await expect(page.getByRole('heading', { name: 'Os Arquivistas', level: 1 })).toBeVisible()

  // O próximo é o buraco no meio (S01E05), não o seguinte ao último visto.
  await expect(page.getByRole('button', { name: /Assisti S01E05/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Temporada 1, episódio 5.*próximo a assistir/ })).toBeVisible()

  await page.getByRole('button', { name: /Temporada 1, episódio 5.*próximo/ }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('button', { name: 'Mostrar sinopse — pode ter spoiler' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Mostrar sinopse — pode ter spoiler' }).click()
  await sheet.getByRole('button', { name: 'Assisti agora' }).click()
  await expect(sheet.getByText('1 vez')).toBeVisible()
  await page.keyboard.press('Escape')

  // A terceira temporada ainda não saiu: círculo tracejado, sem botão.
  await page.getByRole('tab', { name: /Temporada 3/ }).click()
  await expect(page.getByRole('img', { name: /Temporada 3, episódio 1 ainda não saiu: libera sábado às 22:00/ })).toBeVisible()
})

test('Série: marcar a temporada pede confirmação e marca só o que falta', async ({ page }) => {
  const api = await open(page, '/serie/14')
  await page.getByRole('tab', { name: /Temporada 2/ }).click()
  await page.getByRole('button', { name: 'Marcar temporada (5)' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar 5' }).click()
  await expect(page.getByText('5 episódios marcados')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Temporada em dia' })).toBeVisible()
  expect(api.calls.some((c) => c.path === '/series/14/seasons/2/watch')).toBe(true)
})

test('Agenda: dia a dia no curto prazo, mês a mês depois', async ({ page }) => {
  await open(page, '/agenda')
  const titles = page.locator('main section h2')
  await expect(titles.first()).toHaveText('Hoje')
  await expect(titles.nth(1)).toHaveText('Amanhã')
  await expect(page.getByRole('region', { name: /^Novembro/ })).toContainText('A Última Estação')

  // S03E12 é o segundo episódio a sair da temporada: não é estreia e some com o filtro.
  await expect(page.getByText('S03E12')).toHaveCount(1)
  await page.getByRole('switch', { name: 'Só estreias de temporada' }).click()
  await expect(page).toHaveURL(/estreias=true/)
  await expect(page.getByText('S03E12')).toHaveCount(0)
  await expect(page.getByText('S03E11')).toHaveCount(1)
})

test('Números: herói, calendário do ano e tabelas por trás dos gráficos', async ({ page }) => {
  await open(page, '/numeros')
  await expect(page.getByText('Tempo diante da tela')).toBeVisible()
  await expect(page.getByText('310', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Exibições por dia em 2026' })).toBeVisible()
  await page.getByRole('button', { name: 'Ano anterior' }).click()
  await expect(page).toHaveURL(/ano=2025/)
  await expect(page.getByRole('img', { name: 'Exibições por dia em 2025' })).toBeVisible()
  await page.getByText('Ver os números').first().click()
  await expect(page.getByRole('cell', { name: 'abril de 2025' })).toBeVisible()
})

test('Buscar: adicionar leva à página da série', async ({ page }) => {
  await open(page, '/buscar')
  await page.getByPlaceholder('Severance, Dark, Pokémon…').fill('farol')
  await expect(page.getByText('Já no seu acervo')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Assistindo · abrir' })).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Farol Distante' }).getByRole('button', { name: 'Adicionar' }).first().click()
  await expect(page).toHaveURL(/\/serie\/502/)
  await expect(page.getByRole('heading', { name: 'Farol Distante', level: 1 })).toBeVisible()
})

test('Conta: tema, exportação e sair', async ({ page }) => {
  await open(page, '/conta')
  await page.getByRole('radio', { name: 'Escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar tudo em JSON' }).click()
  expect((await download).suggestedFilename()).toBe('reprise-2026-09-24.json')

  await page.getByRole('button', { name: 'Sair deste navegador' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair' }).click()
  // Quem clicou em Sair não volta para onde estava: sem ?redirect.
  await expect(page).toHaveURL(/\/entrar$/)
})

/* ---------- Capturas para revisão visual (só com CAPTURAS=pasta) ---------- */

const shots = process.env.CAPTURAS
test.describe('capturas', () => {
  test.skip(!shots, 'defina CAPTURAS=<pasta> para gerar as capturas')
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, path] of [
      ['agora', '/'],
      ['acervo', '/acervo'],
      ['serie', '/serie/1'],
      ['episodio', '/serie/2?ep=2105'],
      ['agenda', '/agenda'],
      ['numeros', '/numeros'],
      ['buscar', '/buscar?q=farol'],
      ['conta', '/conta'],
      ['entrar', '/entrar'],
    ] as const) {
      test(`${name} ${theme}`, async ({ page }, info) => {
        await open(page, path, { theme, loggedIn: name !== 'entrar' })
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(600)
        await page.screenshot({ path: `${shots}/${info.project.name}-${name}-${theme}.png`, fullPage: true })
      })
    }
  }
})
