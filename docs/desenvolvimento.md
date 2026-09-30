# Desenvolvimento

Como rodar a API e o web direto na máquina, com recarga e depurador, e como rodar os testes. Para
só usar o Reprise, o [docker-compose](../README.pt-BR.md#início-rápido-com-docker) é mais simples.

## Pré-requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (a versão exata está no `global.json`)
- [Node.js 24](https://nodejs.org/) (`.nvmrc`) e [pnpm](https://pnpm.io/) — com `corepack enable`,
  o Node instala o pnpm da versão declarada no `package.json`
- [Docker](https://www.docker.com/), para o Postgres e para os testes de integração

## Subindo tudo

```bash
cp .env.example .env
docker compose up -d db                                     # só o Postgres, na 5432

# A API não lê o .env: em desenvolvimento, os segredos ficam no user-secrets.
dotnet user-secrets set "Jwt:Secret" "$(openssl rand -base64 48)" --project apps/api/Reprise.Api
dotnet user-secrets set "Tmdb:ApiKey" "<sua-chave-v3>" --project apps/api/Reprise.Api   # opcional

dotnet run --project apps/api/Reprise.Importer -- migrate   # cria o banco / aplica migrações
dotnet run --project apps/api/Reprise.Api                   # http://localhost:5156

pnpm install
pnpm dev                                                    # http://localhost:5173
```

A API publica o contrato em `http://localhost:5156/openapi/v1.json` e responde `/health` com o
estado do banco. A conexão vem de `ConnectionStrings__Default` no ambiente; sem ela, vale o padrão
do docker-compose (`localhost:5432`, usuário e senha `reprise`).

A primeira conta sai pela CLI — o cadastro pela tela vem fechado:

```bash
dotnet run --project apps/api/Reprise.Importer -- passwd --email me@reprise.local --password "..." --user seunome
```

`me@reprise.local` é a conta-semente, criada pelas migrações: é nela que a importação do TV Time
grava. Dar senha a ela é o que torna o histórico importado seu. `--user` define o nome para entrar.

### Migrações

A API não migra o banco na partida. Depois de puxar código com migração nova, rode o `migrate` de
novo. Para criar uma migração, com a [ferramenta do EF](https://learn.microsoft.com/ef/core/cli/dotnet):

```bash
dotnet ef migrations add NomeDaMudanca --project apps/api/Reprise.Infrastructure --startup-project apps/api/Reprise.Infrastructure
```

### Segredos

A chave do TMDB e o segredo do JWT **nunca** entram no repositório. Em desenvolvimento ficam no
`dotnet user-secrets`, fora da pasta do projeto; no Docker e em produção, nas variáveis de ambiente
`Tmdb__ApiKey` e `Jwt__Secret` (é o que o compose e a CLI leem).

## Testes

```bash
dotnet test apps/api/Reprise.slnx   # API: unidade + integração (Postgres de verdade via Testcontainers)
pnpm test                           # web: regras do domínio e sessão (Vitest)
pnpm e2e                            # web: ponta a ponta, desktop e celular (Playwright)
pnpm --filter @reprise/web lint
pnpm --filter @reprise/web typecheck
```

Os testes de integração da API precisam do Docker de pé. No Windows com Smart App Control ligado
o `dotnet test` não roda — ver [Windows](windows.md#testes-da-api-com-smart-app-control).

Os e2e não precisam de banco, API nem conta: respondem `/api` com uma API simulada e tipada pelo
mesmo contrato, com relógio fixo. No Windows usam o Edge instalado; em outro sistema, rode antes
`pnpm --filter @reprise/web exec playwright install chromium`.

## Integração contínua

O [workflow de CI](../.github/workflows/ci.yml) roda em todo PR e em todo push na `main`:

| Job | O que confere |
|---|---|
| API (.NET) | build em Release com aviso tratado como erro, e a suíte inteira, inclusive integração |
| Web | lint, tipos, testes unitários e build |
| Web (ponta a ponta) | Playwright no Chromium; guarda os traces quando falha |
| Contrato OpenAPI | sobe a API, regenera `openapi.json` e os tipos do web, e falha se mudarem |
| Imagens Docker | compila as imagens da API, da CLI e do web |

Se o job de contrato falhar, a API mudou e o cliente não acompanhou: com a API de pé, rode
`pnpm --filter @reprise/web api:sync` e versione o resultado. Ver [Cliente web](web.md#contrato-da-api).

## Convenções

- **Código, comentários e commits em português.** Os comentários explicam o porquê, não o quê.
- As versões dos pacotes .NET moram em `apps/api/Directory.Packages.props`; os `.csproj` só dizem
  quais usam. Aviso de compilação é erro (`Directory.Build.props`).
- Regra de negócio do web mora em `src/domain`, em classes testáveis; as telas só a usam.
