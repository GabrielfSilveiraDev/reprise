# Reprise

Rastreador pessoal de séries — substituto do [TV Time](https://www.tvtime.com/), encerrado.
Foco no que importa: **reassistir**. O nome é *reprise* (reexibição/retomada).

## Princípio central

> **Uma exibição é um evento, não um booleano.**

A fonte da verdade é uma tabela append-only `watch_events` — `(episode_id, watched_at, source, is_backfill)`.
Progresso, contagens de rewatch, streaks, estatísticas por mês: tudo é **derivado** desse log,
nunca estado mutável mantido em sincronia.

## Arquitetura

Monorepo:

| Caminho | Stack | Papel |
|---|---|---|
| `apps/api` | ASP.NET Core (.NET 10 LTS), Minimal APIs, EF Core, PostgreSQL | API + importador (CLI) |
| `apps/web` | React + TypeScript + Vite + TanStack Query | cliente web |
| `apps/mobile` | React Native (Expo) | app Android, offline-first |
| `packages/shared` | TypeScript | tipos + cliente gerado do OpenAPI + domínio puro |

A API segue **Vertical Slice + CQRS lógico**, multi-tenant desde o dia 1
(coluna `user_id` + query filter global do EF Core), rodando single-user por ora.

### Projetos .NET (`apps/api`)

```
Reprise.Api            → endpoints Minimal, DI, auth (Identity + JWT), OpenAPI
Reprise.Application    → slices por feature (Import, Watching, Series, Stats)
Reprise.Domain         → entidades, aggregates, enums, invariantes
Reprise.Infrastructure → EF Core, DbContext, migrations, cliente TMDB
Reprise.Importer       → CLI de importação do export do TV Time
Reprise.Tests          → fixtures reais + testes de importação/estatística
```

## Rodando localmente

Pré-requisitos: .NET 10 SDK, Node 22+, Docker.

```bash
cp .env.example .env      # preencha Tmdb__ApiKey e Jwt__Secret
docker compose up -d db   # sobe o Postgres
dotnet run --project apps/api/Reprise.Api
```

A API sobe em `http://localhost:5156` (definido em `launchSettings.json`) e publica o
OpenAPI em `/openapi/v1.json`.

### Segredos

A chave do TMDB **nunca** entra no repositório. Em desenvolvimento:

```bash
dotnet user-secrets set "Tmdb:ApiKey" "<sua-chave-v3>" --project apps/api/Reprise.Api
```

Fora do dev, use a variável de ambiente `Tmdb__ApiKey` (é o que o Compose e a CLI leem).

## Importando o export do TV Time

O export vem do pedido de GDPR do TV Time. A fonte da verdade é
`tracking-prod-records-v2.csv` — os demais arquivos do zip são ignorados, e os de
rastreamento/credenciais (`ip_address`, `refresh_token`, `ad_identifier`, `auth-prod-login`,
`user_connection`, …) **nunca** são lidos. **O export com seus dados pessoais não vai para o
repositório** (ver `.gitignore`).

```bash
# 1. conferência, sem gravar nada
dotnet run --project apps/api/Reprise.Importer -- caminho/do/export.zip --dry-run

# 2. importação de verdade (idempotente — pode rodar de novo sem duplicar)
dotnet run --project apps/api/Reprise.Importer -- caminho/do/export.zip
```

A idempotência usa como chave natural o `key` original de cada linha do CSV, guardado em
`watch_events.source_key` sob um índice único parcial. Reexecutar só cria o que falta.

O relatório final separa **invariantes duros** (nossa contabilidade: toda linha lida foi
classificada) de uma **conferência contra o `tracking-stats` do fornecedor**, que é apenas
informativa — o cache de estatísticas do TV Time não bate nem com os próprios registros dele,
então divergência ali é registrada, não é motivo para abortar.

## Enriquecendo o catálogo pelo TMDB

O export só contém episódios que você assistiu. Sem este passo não existe "próximo a assistir"
nem percentual de progresso — toda série aparece como 100% completa.

```bash
export Tmdb__ApiKey=<sua-chave-v3>

dotnet run --project apps/api/Reprise.Importer -- enrich              # só as séries ainda sem metadados
dotnet run --project apps/api/Reprise.Importer -- enrich --force      # reprocessa todas
dotnet run --project apps/api/Reprise.Importer -- enrich --tvdb 75760 # uma série só
```

O casamento é por **id do TheTVDB** (`find/{id}?external_source=tvdb_id`), nunca por nome.
Série que o TMDB não resolver aparece no relatório e pode ser resolvida à mão inserindo um
`SeriesMatchOverride` (`tvdb_id` → `tmdb_id`).

### Numeração incompatível: alinhamento por ordem

TVDB (fonte do TV Time) e TMDB frequentemente discordam de como repartir uma série em temporadas.
Anime longo é o caso extremo: o TVDB fatia Naruto Shippuden em 22 temporadas, o TMDB usa outra
numeração. Casar por `(temporada, episódio)` ali não acha nada — e tratar o não-achado como
"faltando" fabricaria um catálogo paralelo, afundando o progresso e apontando como "próximo"
episódio já assistido.

Quando mais de 20% dos episódios locais não acham par, o enriquecimento troca de estratégia e
alinha pela **ordem de exibição**: o 1º episódio local vira o 1º do TMDB, o 2º vira o 2º, e assim
por diante. Os episódios existentes são *reposicionados* — mesma linha, mesmo `id`, mesmo
histórico de exibições —, só as coordenadas mudam.

A posição vem do *número* do episódio, não da contagem de linhas: o export só contém o que foi
assistido, então contar linhas comprimiria os buracos. Quem viu do 1 ao 50 e depois do 71 ao 90
mantém os 20 pulados como pulo. Especiais ficam fora da ordem linear e continuam casando por
número.

### Garantias do passo, cobertas por teste

- **Nada é apagado.** Episódio que existe localmente e não tem posição no TMDB fica intocado e é
  contado no relatório. Removê-lo derrubaria em cascata os `watch_events` dele — ou seja, o log
  que é a fonte da verdade.
- **Identidade preservada.** Nem no reposicionamento o `id` do episódio muda, então nenhuma
  exibição se desprende.
- **O runtime do export prevalece.** É com ele que suas estatísticas sempre foram contadas; o
  TMDB só preenche o que está vazio. Quando o valor vem de uma média (e não do episódio),
  `runtime_estimated` marca isso para as estatísticas saberem o que é medido e o que é chute.

## Cliente web

```bash
pnpm install
pnpm --filter @reprise/web dev      # http://localhost:5173
```

O Vite faz proxy de `/api` para a API, então em desenvolvimento não há CORS para manter.

**O cliente TypeScript é gerado, não escrito à mão.** Depois de mexer em qualquer endpoint:

```bash
curl -s http://localhost:5156/openapi/v1.json -o packages/shared/openapi.json
pnpm --filter @reprise/shared generate
```

Os endpoints usam `TypedResults`/`Results<Ok<T>, NotFound>` de propósito: `IResult` puro não
declara o tipo da resposta e o OpenAPI sairia sem schema nenhum.

### Nome das séries

O título exibido é o **original** quando ele está em alfabeto latino, e o **inglês** quando não
está — "ナルト- 疾風伝" não ajuda ninguém que não lê japonês. O título traduzido para português
fica de fora de propósito: era o comportamento anterior e é justamente o que se quis evitar.
A regra vive em `SeriesNamePolicy`, é pura e testada.

### Estatísticas

As agregações são SQL na Infrastructure — `FILTER (WHERE)`, `date_trunc`, `GROUP BY` sobre
dezenas de milhares de eventos é o que o Postgres faz bem e o LINQ traduz mal. O contrato e os
DTOs ficam na Application; só o SQL desce. **Atenção:** o query filter global do EF não alcança
SQL cru, então todo comando lá filtra `user_id` explicitamente.

Marcações em massa (o backfill do TV Time, todas com a mesma data) ficam **fora por padrão** —
com elas dezembro/2025 engole qualquer gráfico temporal. O painel mostra quantas estão ocultas
e oferece o toggle, numa linha de filtro única que reescopa todos os gráficos.

Gráficos de uma série só, um acento por gráfico: colorir barra por tamanho duplicaria o
comprimento num canal que não acrescenta nada. Cada gráfico tem tabela equivalente, tooltip é
reforço e nunca o único caminho para o valor, e o heatmap usa rampa sequencial de uma cor.

### Desenho

Editorial e tipográfico, não uma grade de pôsteres com selo colorido. Duas densidades na
lista (linha compacta para varrer o acervo, cartão expandido para navegar sem pressa) e,
no detalhe, a **trilha de blocos**: um bloco por episódio, altura proporcional a quantas
vezes você assistiu. A escala é relativa à própria série — numa série vista uma vez só, uma
exibição já enche o bloco; numa que você reassistiu 17 vezes, uma exibição é um traço baixo.

### Acessibilidade

Requisito, não verniz. Verificado no navegador contra os dados reais:

- **Contraste AA nos dois temas** — 11 pares medidos, texto ≥ 4,5:1 e objeto gráfico ≥ 3:1.
- **Nenhum estado só por cor** — a contagem de exibições aparece como texto (`16×`), o não
  assistido ganha contorno tracejado além do tom, e o item de navegação ativo combina peso,
  cor e sublinhado.
- **Teclado** — foco visível sempre, link de pular para o conteúdo, e a lista de episódios usa
  foco itinerante: uma parada de tab para a lista toda, setas entre as linhas.
  <kbd>M</kbd> marca (de novo = rewatch) · <kbd>U</kbd> desmarca · <kbd>A</kbd> marca até ali.
- **Alvos de toque ≥ 44px** em todos os controles.
- `prefers-reduced-motion` respeitado — nenhuma animação carrega significado.

## Roadmap

1. ~~**Modelo + importador** com relatório de conferência + enriquecimento TMDB~~ ✅
2. ~~API de leitura + endpoints de marcação~~ ✅
3. ~~Web: lista, detalhe com trilha de episódios, marcação~~ ✅
4. ~~Web: estatísticas~~ ✅
5. Mobile: paridade essencial + offline
6. Fase 2: estreias/notificações, rewatch como sessão, filmes, export próprio em JSON
