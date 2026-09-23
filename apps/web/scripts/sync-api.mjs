/**
 * Gera `src/api/schema.d.ts` a partir do contrato OpenAPI da API.
 *
 *   pnpm api:types   → usa o `openapi.json` versionado (não precisa da API de pé)
 *   pnpm api:sync    → baixa o contrato da API rodando, normaliza, grava e gera os tipos
 *
 * Por que normalizar: o ASP.NET Core 10 descreve todo número como `["integer", "string"]`
 * com um `pattern` numérico, porque o System.Text.Json da web ACEITA número em texto na
 * leitura. Na escrita ele sempre manda número. Sem este passo, cada id do front seria
 * `number | string` e toda comparação precisaria de conversão — um custo espalhado pelo
 * código inteiro para descrever algo que a API nunca faz.
 */
import { readFile, writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

const ROOT = new URL('../', import.meta.url)
const CONTRACT = new URL('openapi.json', ROOT)
const OUTPUT = new URL('src/api/schema.d.ts', ROOT)
const DEFAULT_SOURCE = process.env.REPRISE_API_URL
  ? `${process.env.REPRISE_API_URL.replace(/\/$/, '')}/openapi/v1.json`
  : 'http://localhost:5156/openapi/v1.json'

class OpenApiNormalizer {
  static NUMERIC = new Set(['integer', 'number'])

  /** Percorre o documento e tira o "string" dos tipos numéricos. Devolve quantos ajustou. */
  normalize(node) {
    let changed = 0
    if (Array.isArray(node)) {
      for (const item of node) changed += this.normalize(item)
      return changed
    }
    if (node === null || typeof node !== 'object') return 0

    if (Array.isArray(node.type) && node.type.includes('string') && node.type.some((t) => OpenApiNormalizer.NUMERIC.has(t))) {
      const rest = node.type.filter((t) => t !== 'string')
      node.type = rest.length === 1 ? rest[0] : rest
      delete node.pattern
      changed += 1
    }
    for (const value of Object.values(node)) changed += this.normalize(value)
    return changed
  }
}

async function loadContract(fetchFromApi) {
  if (!fetchFromApi) return JSON.parse(await readFile(CONTRACT, 'utf8'))

  const source = process.argv.find((a) => a.startsWith('http')) ?? DEFAULT_SOURCE
  const response = await fetch(source)
  if (!response.ok) throw new Error(`GET ${source} respondeu ${response.status}`)
  const document = await response.json()
  const changed = new OpenApiNormalizer().normalize(document)
  await writeFile(CONTRACT, `${JSON.stringify(document, null, 2)}\n`)
  console.log(`Contrato baixado de ${source} (${changed} tipos numéricos normalizados).`)
  return document
}

const document = await loadContract(process.argv.includes('--fetch'))
// Idempotente: um contrato já normalizado passa sem mudança e o arquivo não é reescrito.
if (new OpenApiNormalizer().normalize(document) > 0) {
  await writeFile(CONTRACT, `${JSON.stringify(document, null, 2)}\n`)
}

const ast = await openapiTS(document, { alphabetize: false })
const banner = '/* Gerado por scripts/sync-api.mjs a partir de openapi.json — não edite à mão. */\n\n'
await writeFile(OUTPUT, banner + astToString(ast))
console.log(`Tipos gerados em ${OUTPUT.pathname}`)
