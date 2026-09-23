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

type Design = 'brasa' | 'sessao' | 'grade'
const DESIGNS: Design[] = ['brasa', 'sessao', 'grade']

async function open(
  page: Page,
  path: string,
  { loggedIn = true, theme, design }: { loggedIn?: boolean; theme?: 'light' | 'dark'; design?: Design } = {},
) {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', (e) => errors.push(e.message))
  const api = new MockApi()
  await api.install(page)
  await page.clock.setFixedTime(NOW)
  await page.addInitScript(
    ({ session, theme, design }) => {
      if (session && !localStorage.getItem('reprise.session')) localStorage.setItem('reprise.session', JSON.stringify(session))
      if (theme) localStorage.setItem('reprise.theme', theme)
      // Só na primeira carga: um teste que troca o design e recarrega tem de ver a troca.
      if (design && !sessionStorage.getItem('design-set')) {
        localStorage.setItem('reprise.design', design)
        sessionStorage.setItem('design-set', '1')
      }
    },
    { session: loggedIn ? MockApi.session() : null, theme, design },
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

test('Continuar: a revisão entra com o seguinte ao último repetido, sai com um toque e volta com Desfazer', async ({ page }) => {
  const api = await open(page, '/')
  const continuar = page.getByRole('region', { name: 'Continuar' })
  const casa = continuar.locator('article').filter({ hasText: 'Casa de Vidro' })

  // Concluída e sem nada inédito: só está na fila porque os seis primeiros foram revistos.
  await expect(casa).toContainText('Revendo')
  await expect(casa).toContainText('S01E07')

  await casa.getByRole('button', { name: 'Tirar a revisão de Casa de Vidro do Continuar' }).click()
  await expect(page.getByText('Casa de Vidro saiu do Continuar')).toBeVisible()
  await expect(casa).toHaveCount(0)

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(casa).toContainText('S01E07')
  expect(api.calls.filter((c) => c.path === '/series/15/rewatch/dismissal').map((c) => c.method)).toEqual(['PUT', 'DELETE'])

  // Marcar avança a revisão, como avança qualquer fila.
  await casa.getByRole('button', { name: /Marcar .* de Casa de Vidro como visto/ }).click()
  await expect(page.getByText('Casa de Vidro · S01E07 · revisto (2×)')).toBeVisible()
  await expect(casa).toContainText('S01E08')
})

test('Série em revisão: o botão da capa marca o próximo da revisão', async ({ page }) => {
  await open(page, '/serie/15')
  await expect(page.getByRole('heading', { name: 'Casa de Vidro', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: /Assisti S01E07/ })).toBeVisible()
  await expect(page.getByText('Revendo').first()).toBeVisible()
})

test('Design: escolher na Conta muda o app na hora, vale depois de recarregar e também pela paleta', async ({ page }) => {
  await open(page, '/conta')
  await expect(page.locator('html')).toHaveAttribute('data-design', 'brasa')

  await page.getByRole('radio', { name: /^Sessão/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-design', 'sessao')
  await expect(page.getByRole('radio', { name: /^Sessão/ })).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-design', 'sessao')
  await expect(page.getByRole('radio', { name: /^Sessão/ })).toHaveAttribute('aria-checked', 'true')

  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Grade/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-design', 'grade')
  await expect(page.getByRole('radio', { name: /^Grade/ })).toHaveAttribute('aria-checked', 'true')
})

for (const design of DESIGNS) {
  test(`${design}: a fila (com a revisão), o acervo e a série funcionam`, async ({ page }) => {
    const api = await open(page, '/', { design })
    await expect(page.locator('html')).toHaveAttribute('data-design', design)
    await expect(page.getByRole('heading', { name: 'Boa noite, Gabriel.' })).toBeVisible()
    await expect(page.getByText('Revendo').first()).toBeVisible()

    await page.getByRole('button', { name: /Marcar .* de Farol do Norte como visto/ }).first().click()
    await expect(page.getByText('Farol do Norte · S03E06 · visto')).toBeVisible()
    expect(api.calls.some((c) => c.method === 'POST' && c.path === '/episodes/1306/watch')).toBe(true)

    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Acervo' }).click()
    await expect(page.getByRole('heading', { name: 'Acervo', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: /Maré Alta/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Maré Alta', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /Assisti S03E07/ })).toBeVisible()
  })
}

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
  // CAPTURAS_DESIGN=grade (ou sessao, brasa) limita a um design — as três dão 120 capturas.
  const designs = process.env.CAPTURAS_DESIGN ? [process.env.CAPTURAS_DESIGN as Design] : DESIGNS
  for (const design of designs) {
    for (const theme of ['light', 'dark'] as const) {
      for (const [name, path] of [
        ['agora', '/'],
        ['acervo', '/acervo'],
        ['serie', '/serie/1'],
        ['revisao', '/serie/15'],
        ['episodio', '/serie/2?ep=2105'],
        ['agenda', '/agenda'],
        ['numeros', '/numeros'],
        ['buscar', '/buscar?q=farol'],
        ['conta', '/conta'],
        ['entrar', '/entrar'],
      ] as const) {
        test(`${design} ${name} ${theme}`, async ({ page }, info) => {
          await open(page, path, { theme, design, loggedIn: name !== 'entrar' })
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(600)
          await page.screenshot({ path: `${shots}/${design}-${info.project.name}-${name}-${theme}.png`, fullPage: true })
        })
      }
    }
  }
})
