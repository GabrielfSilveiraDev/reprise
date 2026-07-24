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
# (migrations e API entram na Fase 1/2)
```

## Importando o export do TV Time

> Passo a passo detalhado entra na Fase 1, quando o importador existir.

A fonte da verdade do export é `tracking-prod-records-v2.csv`. O importador é idempotente
(chave natural = o `key` original de cada linha), casa séries por **TheTVDB id via TMDB**,
e emite um relatório de conferência ao final. **O export com seus dados pessoais nunca vai
para o repositório** (ver `.gitignore`).

## Roadmap

1. **Modelo + importador** com relatório de conferência ← maior risco, valida a modelagem
2. API de leitura + endpoints de marcação
3. Web: lista, detalhe com trilha de episódios, marcação
4. Web: estatísticas
5. Mobile: paridade essencial + offline
6. Fase 2: estreias/notificações, rewatch como sessão, filmes, export próprio em JSON
