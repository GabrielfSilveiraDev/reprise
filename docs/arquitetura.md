# Arquitetura e decisões

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
| `apps/web` | React 19 + TypeScript + Vite + TanStack Router/Query + Tailwind | cliente web (tipos gerados do OpenAPI da API) |

A API segue **Vertical Slice + CQRS lógico**, multi-tenant desde o dia 1
(coluna `user_id` + query filter global do EF Core). Começou com um usuário só; a autenticação
multiusuário entrou depois sem que nenhuma consulta precisasse mudar (ver abaixo).

### Projetos .NET (`apps/api`)

```
Reprise.Api            → endpoints Minimal, DI, auth (Identity + JWT), OpenAPI
Reprise.Application    → slices por feature (Import, Watching, Series, Stats)
Reprise.Domain         → entidades, aggregates, enums, invariantes
Reprise.Infrastructure → EF Core, DbContext, migrations, clientes do TMDB e do TVmaze
Reprise.Importer       → CLI: importação do TV Time, enriquecimento, migrações, senha
Reprise.Tests          → fixtures reais + testes de importação/estatística
```

## Autenticação

Multiusuário: cada pessoa com login próprio e histórico separado. O `User` é a identidade do
ASP.NET Identity **na mesma tabela `users`** de sempre — o `Id` é a chave de tenant de
`tracked_series`, `watch_events`, `import_runs` e `processed_actions`, e trocá-lo obrigaria a
remapear dezenas de milhares de linhas.

```bash
# Gere o segredo e defina a senha da sua conta
export Jwt__Secret="$(openssl rand -base64 48)"
dotnet run --project apps/api/Reprise.Importer -- passwd --email voce@exemplo.com --password "..."
```

Token de acesso de 30 min + refresh de 60 dias, **rotativo**: renovar consome o antigo. Sem o par,
a escolha seria entre pedir senha no meio da série e um token longo impossível de revogar. O
refresh é guardado só como **hash** — vazamento do banco não entrega sessão de ninguém.

O cadastro é **fechado por padrão** (`Jwt__AllowRegistration`). Numa API exposta, aberto é porta
aberta.

Login, cadastro, código de validação e reenvio têm **limite de tentativas**: 10 por minuto por
endereço (`Api__AuthAttemptsPerMinute`), com o rate limiter do próprio ASP.NET Core. Sem ele, a
senha e o código de seis dígitos aceitariam palpites sem fim. Refresh e logout ficam de fora — o
token não é adivinhável, e o cliente o renova sozinho. Atrás de proxy reverso, a API só enxerga o
endereço real com `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` (ligado no docker-compose, onde a API
só é alcançável pelo nginx); numa API exposta direto, deixe desligado. Ver `AuthRateLimit`.

O cadeado de acesso (`Api__AccessToken`) continua e resolve outra coisa: ele fecha a porta do
prédio — nem a tela de login fica exposta —, enquanto o JWT diz quem é a pessoa lá dentro.

## Export dos seus dados

A razão de o projeto existir: o TV Time fechou levando os dados junto.

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5156/export -o reprise.json
```

**Completo e reconstruível**, não um resumo: cada exibição com data, origem e a marca de backfill,
endereçada por coordenadas estáveis (`tvdbId` + temporada + episódio), não por ids internos que
não significam nada fora desta instalação. No web, Conta e dados → Baixar tudo em JSON.

## Histórico do projeto

1. ~~**Modelo + importador** com relatório de conferência + enriquecimento TMDB~~ ✅
2. ~~API de leitura + endpoints de marcação~~ ✅
3. ~~Web: lista, detalhe com trilha de episódios, marcação~~ ✅
4. ~~Web: estatísticas~~ ✅
5. ~~Mobile: paridade essencial + offline~~ ✅
6. ~~Fase 2: export em JSON, calendário de estreias, notificações, rewatch como sessão
   e autenticação multiusuário~~ ✅
7. ~~Web refeito do zero (setembro de 2026)~~ ✅ — o app Android e o pacote compartilhado saíram
   junto com o web antigo; um cliente móvel novo, se vier, parte do mesmo contrato OpenAPI

**Fora de escopo:** filmes. O modelo inteiro assume série → temporada → episódio, e acomodá-los
exigiria tornar `watch_events.episode_id` polimórfico — mexer na tabela que é a fonte da verdade
do projeto. Não é impossível, é desproporcional ao que um rastreador de séries precisa ser.
