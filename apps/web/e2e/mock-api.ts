import type { Page, Route } from '@playwright/test'
import type { components } from '../src/api/schema'

type S = components['schemas']
type Episode = S['EpisodeDto']
type Detail = S['SeriesDetailDto']

/** Quinta-feira, 24/09/2026, 18h em Brasília. Todos os testes rodam neste instante. */
export const NOW = new Date('2026-09-24T21:00:00Z')
const DAY = 86_400_000

/** PRNG determinístico (mulberry32): as mesmas "exibições" em toda execução. */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (ms: number) => new Date(ms).toISOString()
const isoDate = (ms: number) => iso(ms).slice(0, 10)

interface Spec {
  id: number
  name: string
  hue: number
  production: string
  status: string
  seasons: number[]
  /** Episódios regulares vistos, em ordem, a partir do primeiro. */
  watched: number
  /** Quantos dos primeiros episódios foram revistos (2× a 4×). */
  rewatched?: number
  /** Deixa um buraco: este episódio (índice regular) fica sem ver. */
  gapAt?: number
  lastDaysAgo: number | null
  /** Episódios futuros ao fim da última temporada: [dias até o primeiro, hora UTC]. */
  upcoming?: { count: number; firstInDays: number; hourUtc: number; newSeason?: boolean }
  specials?: number
  firstAirYear: number
  overview: string
  sessions?: number
}

const SPECS: Spec[] = [
  { id: 1, name: 'Farol do Norte', hue: 12, production: 'Returning Series', status: 'Following', seasons: [8, 8, 10], watched: 21, rewatched: 8, lastDaysAgo: 1, upcoming: { count: 6, firstInDays: 1, hourUtc: 7 }, specials: 2, firstAirYear: 2021, sessions: 3, overview: 'Numa ilha isolada do Atlântico, a faroleira que herdou o posto do pai descobre que a luz do farol guia mais do que navios.' },
  { id: 2, name: 'Os Arquivistas', hue: 205, production: 'Returning Series', status: 'Following', seasons: [10, 10], watched: 13, gapAt: 4, lastDaysAgo: 3, upcoming: { count: 8, firstInDays: 3, hourUtc: 1, newSeason: true }, firstAirYear: 2023, sessions: 1, overview: 'Funcionários de um arquivo público encontram documentos de acontecimentos que ainda não aconteceram.' },
  { id: 3, name: 'Linha Vermelha', hue: 350, production: 'Ended', status: 'Following', seasons: [6, 6, 6, 6], watched: 24, rewatched: 12, lastDaysAgo: 9, firstAirYear: 2016, sessions: 2, overview: 'Quatro temporadas acompanhando os maquinistas do último trem noturno da cidade.' },
  { id: 4, name: 'Maré Alta', hue: 185, production: 'Returning Series', status: 'Following', seasons: [12, 12, 12], watched: 30, lastDaysAgo: 6, firstAirYear: 2019, sessions: 1, overview: 'Uma família de pescadores tenta manter o barco — e o sobrenome — à tona.' },
  { id: 5, name: 'Quarto 214', hue: 45, production: 'Returning Series', status: 'Following', seasons: [8], watched: 2, lastDaysAgo: 18, upcoming: { count: 2, firstInDays: 0, hourUtc: 23 }, firstAirYear: 2026, sessions: 1, overview: 'Cada episódio, um hóspede diferente no mesmo quarto de hotel.' },
  { id: 6, name: 'Cidade Submersa', hue: 230, production: 'Returning Series', status: 'Following', seasons: [10, 10], watched: 7, lastDaysAgo: 140, firstAirYear: 2022, sessions: 1, overview: 'Mergulhadores mapeiam as ruínas de uma cidade inundada por uma represa.' },
  { id: 7, name: 'A Última Estação', hue: 95, production: 'Returning Series', status: 'Following', seasons: [9], watched: 0, lastDaysAgo: null, upcoming: { count: 1, firstInDays: 48, hourUtc: 8, newSeason: true }, firstAirYear: 2025, overview: 'Pesquisadores numa base antártica perdem contato com o continente.' },
  { id: 8, name: 'Sinal Fraco', hue: 280, production: 'Canceled', status: 'Following', seasons: [10], watched: 10, lastDaysAgo: 30, firstAirYear: 2020, sessions: 1, overview: 'Uma rádio comunitária do interior vira o centro de uma investigação.' },
  { id: 9, name: 'Doze Luas', hue: 260, production: 'Ended', status: 'Finished', seasons: [12, 12], watched: 24, rewatched: 24, lastDaysAgo: 400, firstAirYear: 2014, sessions: 3, overview: 'Uma tripulação atravessa o sistema solar de lua em lua.' },
  { id: 10, name: 'Vizinhos', hue: 30, production: 'Ended', status: 'Finished', seasons: [22, 22, 22], watched: 66, rewatched: 20, lastDaysAgo: 900, firstAirYear: 2008, sessions: 2, overview: 'Comédia sobre um prédio onde todo mundo sabe da vida de todo mundo.' },
  { id: 11, name: 'O Relojoeiro', hue: 160, production: 'Returning Series', status: 'ForLater', seasons: [6], watched: 0, lastDaysAgo: null, firstAirYear: 2024, overview: 'Um relojoeiro consegue voltar exatamente um minuto no tempo.' },
  { id: 12, name: 'Meia-Noite em Lisboa', hue: 330, production: 'Ended', status: 'Archived', seasons: [8, 8], watched: 5, lastDaysAgo: 1200, firstAirYear: 2017, sessions: 1, overview: 'Um detetive insone resolve crimes só entre meia-noite e o amanhecer.' },
  { id: 13, name: 'Expresso Oriente', hue: 70, production: 'Returning Series', status: 'Following', seasons: [10], watched: 9, lastDaysAgo: 2, upcoming: { count: 3, firstInDays: 20, hourUtc: 2, newSeason: true }, firstAirYear: 2025, sessions: 1, overview: 'Passageiros de um trem transcontinental com uma parada que não está no mapa.' },
  { id: 14, name: 'Terra Firme', hue: 120, production: 'Returning Series', status: 'Following', seasons: [8, 8], watched: 11, lastDaysAgo: 12, firstAirYear: 2023, sessions: 1, overview: 'Engenheiros tentam reerguer uma cidade depois de um terremoto.' },
]

interface State {
  details: Map<number, Detail>
  hue: Map<number, number>
}

function buildDetail(spec: Spec): Detail {
  const random = rng(spec.id * 97)
  const seasons: S['SeasonDto'][] = []
  let regularIndex = 0
  const totalRegular = spec.seasons.reduce((a, b) => a + b, 0)
  const start = Date.UTC(spec.firstAirYear, 0, 10)
  const lastPast = NOW.getTime() - 20 * DAY
  const spacing = Math.max(DAY, (lastPast - start) / Math.max(1, totalRegular))
  const lastWatch = spec.lastDaysAgo === null ? null : NOW.getTime() - spec.lastDaysAgo * DAY - 2 * 3600_000

  const episode = (season: number, number: number, airMs: number, releasesAt: string, watchCount: number, lastWatchedAt: string | null): Episode => ({
    id: spec.id * 1000 + season * 100 + number,
    seasonNumber: season,
    episodeNumber: number,
    name: season === 0 ? `Especial ${number}` : TITLES[(spec.id * 7 + season * 3 + number) % TITLES.length]!,
    runtimeSeconds: 60 * (38 + Math.floor(random() * 22)),
    isSpecial: season === 0,
    watchCount,
    lastWatchedAt,
    stillPath: random() > 0.25 ? `/s-${spec.id}-${season}-${number}.jpg` : null,
    overview: random() > 0.15 ? SYNOPSES[(spec.id + number) % SYNOPSES.length]! : null,
    airDate: isoDate(airMs),
    releasesAt,
  })

  spec.seasons.forEach((count, s) => {
    const season = s + 1
    const episodes: Episode[] = []
    for (let n = 1; n <= count; n++) {
      const airMs = start + regularIndex * spacing
      const watchedHere = regularIndex < spec.watched && regularIndex !== spec.gapAt
      let watchCount = watchedHere ? 1 : 0
      if (watchedHere && regularIndex < (spec.rewatched ?? 0)) watchCount += 1 + Math.floor(random() * 3)
      const when = watchedHere && lastWatch ? iso(lastWatch - (spec.watched - 1 - regularIndex) * DAY * 1.5) : null
      episodes.push(episode(season, n, airMs, iso(airMs + DAY + 7 * 3600_000), watchCount, when))
      regularIndex += 1
    }
    seasons.push({ seasonNumber: season, name: null, isSpecials: false, episodes })
  })

  if (spec.upcoming) {
    const u = spec.upcoming
    const season = u.newSeason ? spec.seasons.length + 1 : spec.seasons.length
    const target = u.newSeason ? { seasonNumber: season, name: null, isSpecials: false, episodes: [] as Episode[] } : seasons[seasons.length - 1]!
    if (u.newSeason) seasons.push(target)
    const base = target.episodes.length
    for (let i = 0; i < u.count; i++) {
      const release = Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() + u.firstInDays + i * 7, u.hourUtc)
      const e = episode(season, base + i + 1, release - 5 * 3600_000, iso(release), 0, null)
      target.episodes.push({ ...e, stillPath: null, overview: i === 0 ? SYNOPSES[0]! : null })
    }
  }

  if (spec.specials) {
    const episodes = Array.from({ length: spec.specials }, (_, i) =>
      episode(0, i + 1, start + i * 200 * DAY, iso(start + i * 200 * DAY + DAY), i === 1 ? 2 : 0, i === 1 ? iso(NOW.getTime() - 300 * DAY) : null),
    )
    seasons.push({ seasonNumber: 0, name: null, isSpecials: true, episodes })
  }

  const sessions: S['RewatchSessionDto'][] = []
  for (let i = 0; i < (spec.sessions ?? 0); i++) {
    const end = (lastWatch ?? NOW.getTime()) - (spec.sessions! - 1 - i) * 520 * DAY
    const startedAt = end - (40 + i * 25) * DAY
    sessions.push({ ordinal: i + 1, startedAt: iso(startedAt), endedAt: iso(end), exhibitions: 18 + i * 7, distinctEpisodes: 16 + i * 5, totalSeconds: (18 + i * 7) * 2700, spanDays: 40 + i * 25 + 1 })
  }

  return {
    id: spec.id,
    tvdbId: 70000 + spec.id,
    name: spec.name,
    originalName: spec.id === 12 ? 'Midnight in Lisbon' : null,
    overview: spec.overview,
    posterPath: `/p-${spec.id}.jpg`,
    status: spec.status,
    productionStatus: spec.production,
    firstAirDate: `${spec.firstAirYear}-01-10`,
    episodesTotal: 0,
    episodesAired: 0,
    episodesWatched: 0,
    completionRatio: 0,
    seasons,
    sessions,
    backfillExhibitions: spec.id === 10 ? 58 : 0,
  }
}

const TITLES = ['O Começo', 'Maré de Março', 'A Chave', 'Silêncio', 'Portas Abertas', 'O Mapa', 'Ferrugem', 'Correnteza', 'Última Chamada', 'Pontes', 'Vidro', 'O Inventário', 'Carta Branca', 'Neblina', 'O Retorno', 'Fio da Navalha', 'Sal', 'Contagem', 'Eco', 'Horizonte']
const SYNOPSES = [
  'Uma chegada inesperada muda os planos de todos, e um segredo antigo começa a vir à tona.',
  'Enquanto a tempestade se aproxima, uma decisão difícil separa os dois irmãos.',
  'A investigação chega a um nome que ninguém queria ouvir, e a equipe precisa escolher um lado.',
  'Uma festa de aniversário sai do controle quando um convidado revela o que viu naquela noite.',
]

/** Recalcula os agregados do detalhe — o que o servidor faz a partir do log. */
function refresh(detail: Detail): Detail {
  const regular = detail.seasons.filter((s) => !s.isSpecials).flatMap((s) => s.episodes)
  const released = regular.filter((e) => !e.releasesAt || Date.parse(e.releasesAt) <= NOW.getTime())
  const watched = regular.filter((e) => e.watchCount > 0)
  return {
    ...detail,
    episodesTotal: regular.length,
    episodesAired: released.length,
    episodesWatched: watched.length,
    completionRatio: regular.length ? watched.length / regular.length : 0,
  }
}

function listItem(d: Detail): S['SeriesListItemDto'] {
  const regular = d.seasons.filter((s) => !s.isSpecials).flatMap((s) => s.episodes)
  const next = regular.find((e) => e.watchCount === 0 && (!e.releasesAt || Date.parse(e.releasesAt) <= NOW.getTime()))
  const last = d.seasons.flatMap((s) => s.episodes).map((e) => e.lastWatchedAt).filter(Boolean).sort().pop() ?? null
  return {
    id: d.id,
    tvdbId: d.tvdbId,
    name: d.name,
    posterPath: d.posterPath,
    status: d.status,
    productionStatus: d.productionStatus,
    episodesTotal: d.episodesTotal,
    episodesAired: d.episodesAired,
    episodesWatched: d.episodesWatched,
    completionRatio: d.completionRatio,
    lastWatchedAt: last,
    nextUp: next ? { id: next.id, seasonNumber: next.seasonNumber, episodeNumber: next.episodeNumber, name: next.name } : null,
  }
}

function posterSvg(label: string, hue: number, wide = false): string {
  const [w, h] = wide ? [640, 360] : [400, 600]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 42%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 16%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${w * 0.72}" cy="${h * 0.3}" r="${w * 0.22}" fill="hsl(${hue} 70% 70% / .35)"/>
<text x="28" y="${h - 40}" font-family="Georgia, serif" font-size="${wide ? 34 : 46}" font-weight="700" fill="white">${label}</text>
</svg>`
}

/**
 * Uma API do Reprise em memória, no formato do contrato real (os tipos vêm do schema gerado).
 * Marca, desmarca, muda estado e adiciona série de verdade — os testes exercitam o fluxo, não
 * só a primeira tela.
 */
export class MockApi {
  private readonly state: State = { details: new Map(), hue: new Map() }
  readonly calls: { method: string; path: string; body: unknown }[] = []

  constructor() {
    for (const spec of SPECS) {
      this.state.details.set(spec.id, refresh(buildDetail(spec)))
      this.state.hue.set(spec.id, spec.hue)
    }
  }

  async install(page: Page): Promise<void> {
    await page.route('https://image.tmdb.org/**', (route) => this.image(route))
    // Só o que começa com /api — o Vite serve o código-fonte em /src/api/, que não é da API.
    await page.route((url) => url.pathname === '/api' || url.pathname.startsWith('/api/'), (route) => this.handle(route))
  }

  static session(): S['SessionDto'] {
    return {
      accessToken: 'token-teste',
      refreshToken: 'refresh-teste',
      accessTokenExpiresAt: iso(NOW.getTime() + 3600_000),
      userId: '00000000-0000-0000-0000-000000000001',
      displayName: 'Gabriel Silveira',
      email: 'gabriel@exemplo.com',
    }
  }

  private image(route: Route) {
    const path = new URL(route.request().url()).pathname
    const poster = /\/p-(\d+)\./.exec(path)
    const still = /\/s-(\d+)-(\d+)-(\d+)\./.exec(path)
    if (poster) {
      const id = Number(poster[1])
      const name = this.state.details.get(id)?.name ?? 'Nova'
      return route.fulfill({ contentType: 'image/svg+xml', body: posterSvg(name.split(' ')[0]!, this.state.hue.get(id) ?? 20) })
    }
    if (still) {
      const id = Number(still[1])
      return route.fulfill({ contentType: 'image/svg+xml', body: posterSvg(`T${still[2]} · E${still[3]}`, (this.state.hue.get(id) ?? 20) + 20, true) })
    }
    return route.fulfill({ contentType: 'image/svg+xml', body: posterSvg('?', 30) })
  }

  private json(route: Route, body: unknown, status = 200) {
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  }

  private async handle(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api/, '') || '/'
    const method = request.method()
    const body = request.postData() ? JSON.parse(request.postData()!) : null
    this.calls.push({ method, path, body })

    if (path !== '/' && !path.startsWith('/auth') && request.headers()['authorization'] !== 'Bearer token-teste') {
      return route.fulfill({ status: 401 })
    }

    let m: RegExpExecArray | null
    if (method === 'GET' && path === '/') return this.json(route, { name: 'Reprise API' })
    if (method === 'POST' && path === '/auth/login') {
      return body.password === 'senha-certa' ? this.json(route, MockApi.session()) : route.fulfill({ status: 401 })
    }
    if (method === 'POST' && path === '/auth/logout') return route.fulfill({ status: 204 })
    if (method === 'GET' && path === '/series') return this.json(route, this.list())
    if (method === 'GET' && path === '/next-up') return this.json(route, this.nextUp())
    if (method === 'GET' && path === '/premieres') return this.json(route, this.premieres())
    if (method === 'GET' && path === '/series/search') return this.json(route, this.search(url.searchParams.get('q') ?? ''))
    if (method === 'POST' && path === '/series') return this.json(route, this.add(body.tmdbId))
    if (method === 'PATCH' && path === '/series/status') {
      for (const c of body as { seriesId: number; status: string }[]) this.setStatus(c.seriesId, c.status)
      return this.json(route, { updated: body.length, notFound: [] })
    }
    if ((m = /^\/series\/(\d+)\/status$/.exec(path)) && method === 'PATCH') {
      this.setStatus(Number(m[1]), body.status)
      return this.json(route, { updated: 1, notFound: [] })
    }
    if ((m = /^\/series\/(\d+)$/.exec(path)) && method === 'GET') {
      const d = this.state.details.get(Number(m[1]))
      return d ? this.json(route, d) : route.fulfill({ status: 404 })
    }
    if ((m = /^\/series\/(\d+)\/seasons\/(\d+)\/watch$/.exec(path))) {
      return this.json(route, { marked: this.bulk(Number(m[1]), (e) => e.seasonNumber === Number(m![2])) })
    }
    if ((m = /^\/series\/(\d+)\/watch-up-to$/.exec(path))) {
      const { seasonNumber: s, episodeNumber: n } = body
      return this.json(route, { marked: this.bulk(Number(m[1]), (e) => e.seasonNumber > 0 && (e.seasonNumber < s || (e.seasonNumber === s && e.episodeNumber <= n))) })
    }
    if ((m = /^\/episodes\/(\d+)\/watch$/.exec(path))) {
      const found = this.findEpisode(Number(m[1]))
      if (!found) return route.fulfill({ status: 404 })
      const { detail, episode } = found
      if (method === 'POST') {
        if (episode.releasesAt && Date.parse(episode.releasesAt) > NOW.getTime()) {
          return this.json(route, { title: 'Episódio ainda não exibido', detail: 'Este episódio ainda vai ao ar — não dá para marcá-lo como visto.', status: 422 }, 422)
        }
        episode.watchCount += 1
        episode.lastWatchedAt = body?.watchedAt ?? NOW.toISOString()
      } else {
        episode.watchCount = Math.max(0, episode.watchCount - 1)
        if (episode.watchCount === 0) episode.lastWatchedAt = null
      }
      this.state.details.set(detail.id, refresh(detail))
      return this.json(route, { episodeId: episode.id, watchCount: episode.watchCount, lastWatchedAt: episode.lastWatchedAt })
    }
    if (method === 'GET' && path === '/stats/overview') return this.json(route, this.overview())
    if (method === 'GET' && path === '/stats/calendar') return this.json(route, this.calendar(Number(url.searchParams.get('year'))))
    if (method === 'GET' && path === '/me') return this.json(route, this.me())
    if (method === 'GET' && path === '/export') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Content-Disposition': 'attachment; filename="reprise-2026-09-24.json"' },
        body: JSON.stringify({ format: 'reprise-export/1', series: this.list().length }),
      })
    }
    return route.fulfill({ status: 404, body: `sem mock para ${method} ${path}` })
  }

  list() {
    return [...this.state.details.values()].map(listItem).sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? '') || a.name.localeCompare(b.name))
  }

  private nextUp(): S['NextUpItemDto'][] {
    return this.list()
      .filter((s) => s.status === 'Following' && s.nextUp)
      .map((s) => ({ seriesId: s.id, seriesName: s.name, posterPath: s.posterPath, episode: s.nextUp!, lastActivityAt: s.lastWatchedAt }))
  }

  private premieres(): S['PremiereDto'][] {
    const out: S['PremiereDto'][] = []
    for (const d of this.state.details.values()) {
      if (d.status !== 'Following') continue
      const last = listItem(d).lastWatchedAt
      for (const season of d.seasons) {
        const future = season.episodes.filter((e) => e.releasesAt && Date.parse(e.releasesAt) > NOW.getTime())
        const first = Math.min(...future.map((e) => e.episodeNumber))
        for (const e of future) {
          out.push({
            episodeId: e.id, seriesId: d.id, seriesName: d.name, posterPath: d.posterPath, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber,
            episodeName: e.name, stillPath: e.stillPath, airDate: e.airDate!, releasesAt: e.releasesAt, isSeasonPremiere: e.episodeNumber === 1 || e.episodeNumber === first,
            overview: e.overview, lastActivityAt: last,
          })
        }
      }
    }
    return out.sort((a, b) => a.releasesAt!.localeCompare(b.releasesAt!))
  }

  private search(q: string): S['SeriesSearchResultDto'][] {
    if (!q) return []
    return [
      { tmdbId: 501, name: 'Farol do Norte', originalName: 'Northern Light', overview: SPECS[0]!.overview, posterPath: '/p-1.jpg', firstAirDate: '2021-01-10', seriesId: 1, trackedStatus: 'Following' },
      { tmdbId: 502, name: 'Farol Distante', originalName: 'Faraway Beacon', overview: 'Dois irmãos reformam um farol abandonado e encontram um diário.', posterPath: '/p-502.jpg', firstAirDate: '2019-05-02', seriesId: null, trackedStatus: null },
      { tmdbId: 503, name: 'Faróis', originalName: null, overview: 'Documentário sobre os últimos faroleiros do litoral brasileiro.', posterPath: null, firstAirDate: '2024-03-15', seriesId: null, trackedStatus: null },
    ]
  }

  private add(tmdbId: number): S['AddSeriesResultDto'] {
    const id = tmdbId
    const spec: Spec = { id, name: 'Farol Distante', hue: 200, production: 'Returning Series', status: 'Following', seasons: [6, 6], watched: 0, lastDaysAgo: null, firstAirYear: 2019, overview: 'Dois irmãos reformam um farol abandonado e encontram um diário.' }
    this.state.details.set(id, refresh(buildDetail(spec)))
    this.state.hue.set(id, spec.hue)
    return { seriesId: id, name: spec.name, alreadyTracked: false, episodesCreated: 12 }
  }

  private setStatus(id: number, status: string) {
    const d = this.state.details.get(id)
    if (d) this.state.details.set(id, { ...d, status })
  }

  private bulk(seriesId: number, pick: (e: Episode) => boolean): number {
    const d = this.state.details.get(seriesId)
    if (!d) return 0
    let marked = 0
    for (const e of d.seasons.flatMap((s) => s.episodes)) {
      if (pick(e) && e.watchCount === 0 && (!e.releasesAt || Date.parse(e.releasesAt) <= NOW.getTime())) {
        e.watchCount = 1
        e.lastWatchedAt = NOW.toISOString()
        marked += 1
      }
    }
    this.state.details.set(seriesId, refresh(d))
    return marked
  }

  private findEpisode(id: number) {
    for (const detail of this.state.details.values()) {
      const episode = detail.seasons.flatMap((s) => s.episodes).find((e) => e.id === id)
      if (episode) return { detail, episode }
    }
    return null
  }

  private overview(): S['StatsOverviewDto'] {
    const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
    const byYear = years.map((y, i) => ({ label: String(y), exhibitions: [180, 420, 610, 380, 290, 520, 700, 430][i]!, seconds: [180, 420, 610, 380, 290, 520, 700, 430][i]! * 2600 }))
    const byMonth = years.flatMap((y) =>
      Array.from({ length: y === 2026 ? 9 : 12 }, (_, m) => {
        const r = rng(y * 13 + m)()
        const ex = Math.round(10 + r * 80)
        return { label: `${y}-${String(m + 1).padStart(2, '0')}`, exhibitions: ex, seconds: ex * 2600 }
      }).filter((b) => b.label !== '2025-04'),
    )
    return {
      summary: { exhibitions: 10391, distinctEpisodes: 8120, seriesCount: 118, totalSeconds: 10391 * 2580, backfillExhibitions: 2851, rewatchRate: (10391 - 8120) / 10391, firstWatchedAt: '2019-02-03T22:10:00Z', lastWatchedAt: iso(NOW.getTime() - DAY) },
      byYear,
      byMonth,
      topSeries: [...this.state.details.values()].slice(0, 8).map((d, i) => ({ seriesId: d.id, name: d.name, exhibitions: 900 - i * 90, distinctEpisodes: 400 - i * 30, seconds: (900 - i * 90) * 2500 })),
      streaks: { longestDays: 47, currentDays: 4, longestStartedAt: '2021-06-02', longestEndedAt: '2021-07-18' },
      availableYears: [...years].reverse(),
    }
  }

  private calendar(year: number): S['CalendarDayDto'][] {
    const random = rng(year)
    const out: S['CalendarDayDto'][] = []
    for (let t = Date.UTC(year, 0, 1); t <= Math.min(Date.UTC(year, 11, 31), NOW.getTime()); t += DAY) {
      const r = random()
      if (r < 0.45) continue
      const ex = r > 0.97 ? 9 : r > 0.88 ? 5 : r > 0.7 ? 3 : r > 0.6 ? 2 : 1
      out.push({ date: isoDate(t), exhibitions: ex, seconds: ex * 2600 })
    }
    return out
  }

  private me(): S['ProfileDto'] {
    const list = this.list()
    const count = (s: string) => list.filter((x) => x.status === s).length
    return {
      displayName: 'Gabriel Silveira', email: 'gabriel@exemplo.com', memberSince: '2019-02-01T12:00:00Z',
      seriesTracked: list.length, seriesFollowing: count('Following'), seriesFinished: count('Finished'), seriesArchived: count('Archived'),
      catalogEpisodes: list.reduce((a, s) => a + s.episodesTotal, 0), seriesWithoutMetadata: 0, lastImportedAt: '2026-07-30T14:00:00Z',
    }
  }
}
