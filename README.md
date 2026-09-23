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

### Testes da API

```bash
dotnet test apps/api/Reprise.slnx
```

**No Windows com Smart App Control ligado, use isto:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\testar-api.ps1
```

O `-ExecutionPolicy Bypass` vale só para essa invocação e não muda configuração nenhuma da máquina.
É necessário porque o Windows vem com a política em `Restricted`, que recusa qualquer `.ps1` — se
preferir rodar o script direto, `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` resolve de vez,
mas é uma decisão de segurança e por isso não vai feita por padrão.

Os testes de integração sobem um Postgres de verdade por Testcontainers, que carrega uma DLL de
terceiro sem assinatura digital (`Docker.DotNet.Handler.Abstractions.dll`). O Smart App Control
recusa carregá-la — evento 3077 do Code Integrity, erro `0x800711C7` — e os 17 testes de
integração falham antes de rodar. Os outros 76 passam, o que faz a falha parecer um problema do
projeto quando é da máquina.

O script roda a suíte dentro de um container Linux, onde a política não alcança. Desligar o
Smart App Control também resolveria, mas é irreversível: o Windows não deixa religá-lo sem
reinstalar o sistema.

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

### País de origem: quando o episódio sai

```bash
dotnet run --project apps/api/Reprise.Importer -- paises           # só quem ainda não tem
dotnet run --project apps/api/Reprise.Importer -- paises --force   # reconsulta todas
```

Comando à parte do `enrich` por proporção: o enriquecimento reprocessa o catálogo inteiro para
atualizar uma coluna que nasceu depois dos dados. Um id morto no TMDB não derruba o lote — a
série entra no relatório e cai no padrão.

O país é o que diz **em que fuso a data de estreia vale**. A `air_date` do TMDB é data pura, sem
hora nem fuso, e é do calendário do país de origem — conferido na API: não existe campo de
horário nem no episódio nem na série. Sem o país não dá para distinguir uma estreia japonesa de
uma americana no mesmo dia, e é daí que vinha o defeito de um episódio que só sai amanhã
aparecer como "Estreou hoje". Ver `ReleaseSchedule`.

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

## Agenda de estreias pelo TVmaze

```bash
dotnet run --project apps/api/Reprise.Importer -- agenda                  # só as séries sem id do TVmaze
dotnet run --project apps/api/Reprise.Importer -- agenda --force          # reconsulta todas
dotnet run --project apps/api/Reprise.Importer -- agenda --mudou week     # só o que mudou na semana
```

**Não precisa de chave** — a API do TVmaze é aberta. O casamento é pelo **id do TheTVDB**, que já
existe no catálogo desde o export; série sem ele cai na busca por nome, e aí o ano de estreia
precisa bater (com um ano de folga), senão o casamento é recusado: *Monster* e *Dark Matter* são
nomes que várias séries diferentes carregam.

### Por que uma segunda fonte

O TMDB não tem hora de estreia em campo nenhum, e a data dele é a do calendário de origem.
Comparados episódio a episódio contra o acervo real (402 episódios, 32 séries), os dois
concordam em **77%** e divergem em um dia nos outros 22% — **69 de 69 episódios de Apple TV**,
parte dos de Prime Video, e **nada** em Netflix, HBO, Disney+, FX, The CW, Adult Swim ou
Crunchyroll. Era essa divergência que fazia um episódio de sexta aparecer como estreado na
quinta.

Na sincronização completa do acervo: 117 de 118 séries casadas, 6.583 episódios datados, **4.993
com horário exato** (TV linear) e 628 com data diferente do TMDB.

### O que a sincronização não faz

**Não toca no catálogo.** Nome, sinopse, pôster, temporadas e a própria `air_date` do TMDB ficam
como estão — só `tvmaze_air_date` e `tvmaze_air_stamp` são escritos. Guardar ao lado, e não por
cima, é o que permite comparar as fontes depois e torna o comando seguro de repetir.

**Não grava horário que não existe.** Em streaming o TVmaze preenche `airstamp` com meio-dia UTC
de enchimento; a sincronização só aceita o instante quando há `airtime` declarado. Tratar o
placeholder como hora real faria o app anunciar estreia às 9h da manhã — a precisão falsa que
esta integração existe para evitar.

**Não reposiciona episódio.** Quando TVmaze e TMDB repartem a série em temporadas diferentes, o
episódio sem par simplesmente não recebe data do TVmaze e continua valendo pelo TMDB.

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

## App Android

```bash
pnpm --filter @reprise/mobile start          # Metro; leia o QR no Expo Go
pnpm --filter @reprise/mobile android        # abre direto no aparelho/emulador
```

O celular **não enxerga o `localhost` do PC**. Suba a API escutando na rede e aponte o app para
o IP da máquina:

```bash
dotnet run --project apps/api/Reprise.Api --urls http://0.0.0.0:5156
```

O endereço é configurável **em tempo de execução**, na aba Ajustes — trocar de rede não pode
exigir recompilar. `EXPO_PUBLIC_API_URL` serve de valor inicial.

O alvo é o Android. O alvo web do Expo não é suportado: o `expo-sqlite` lá roda em WebAssembly e
não resolve dentro deste monorepo pnpm — e o cliente web do Reprise já é uma aplicação própria.

### Offline não é cache, é fila

O problema central não é guardar leitura — é **escrita repetida**. Num CRUD comum, reenviar uma
requisição que já chegou é inofensivo. Aqui não: marcar duas vezes o mesmo episódio *significa*
que você assistiu duas vezes. Um POST que o servidor processou mas cuja resposta se perdeu no
elevador viraria, na retentativa, um rewatch que nunca aconteceu.

Por isso o app gera um **UUID por ação enfileirada**, antes da primeira tentativa, e reenvia a
mesma chave em cada retentativa. A API registra a chave em `processed_actions` no mesmo
`SaveChanges` que grava o evento: ou os dois existem ou nenhum. O `watchedAt` também é carimbado
no toque, não no envio — a exibição aconteceu quando o dedo tocou a tela, não quando o wi-fi voltou.

A fila é enviada **em ordem estrita** e para no primeiro erro de rede: marcar e depois desmarcar
não é o mesmo que o contrário. Um 4xx (episódio que sumiu num reprocessamento do catálogo) não
pode travar a fila para sempre, então vira **carta morta** — sai do envio mas fica visível em
Ajustes. Descartar em silêncio seria mentir sobre o que foi registrado.

Uma fusão, e só uma, acontece na fila: desmarcar um episódio cuja marcação ainda **não saiu**
anula as duas. Não é economia de rede, é correção — enviando as duas, o servidor removeria "a
exibição mais recente", que pode ser um rewatch antigo e legítimo.

### O que a tela mostra sem rede

O número exibido é o do servidor **mais** a projeção da fila (`OutboxPlanner.project`). Sem isso,
tocar "assisti" no metrô não mudaria nada e o app pareceria quebrado. A projeção é descartável de
propósito: quando a fila esvazia, quem manda volta a ser a contagem derivada pelo servidor — o app
nunca guarda um "assistido" próprio.

O banco local guarda três coisas e só três: respostas da API como vieram, a fila, e o endereço da
API. **Não é uma réplica** do banco do servidor: espelhar séries/episódios duplicaria a derivação
que é a fonte única do projeto.

### Testes

```bash
pnpm --filter @reprise/shared test    # OutboxPlanner puro
pnpm --filter @reprise/mobile test    # fila e cache contra SQLite real + API real
```

Rodam no executor nativo do Node (`node --test`), que carrega `.ts` direto — sem Jest, sem
Vitest, sem passo de build. O `node:sqlite` faz o papel do `expo-sqlite`: mesmo motor, mesmo
dialeto e **o mesmo schema**, importado de `sql-database.ts` em vez de recopiado. Os testes de
entrega usam a API rodando e se pulam sozinhos quando ela não está no ar.

É por isso que `Outbox` e `ResponseCache` recebem o banco de fora em vez de importar o módulo
nativo: sem essa inversão, a peça mais arriscada do app só seria conferível com o celular na mão.

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

O cadeado de acesso (`Api__AccessToken`) continua e resolve outra coisa: ele fecha a porta do
prédio — nem a tela de login fica exposta —, enquanto o JWT diz quem é a pessoa lá dentro.

## Export dos seus dados

A razão de o projeto existir: o TV Time fechou levando os dados junto.

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5156/export -o reprise.json
```

**Completo e reconstruível**, não um resumo: cada exibição com data, origem e a marca de backfill,
endereçada por coordenadas estáveis (`tvdbId` + temporada + episódio), não por ids internos que
não significam nada fora desta instalação. No app, Ajustes → Exportar meus dados passa o arquivo
para a folha de compartilhamento — salvar na pasta privada do aplicativo seria repetir o problema.

## Roadmap

1. ~~**Modelo + importador** com relatório de conferência + enriquecimento TMDB~~ ✅
2. ~~API de leitura + endpoints de marcação~~ ✅
3. ~~Web: lista, detalhe com trilha de episódios, marcação~~ ✅
4. ~~Web: estatísticas~~ ✅
5. ~~Mobile: paridade essencial + offline~~ ✅
6. ~~Fase 2: export em JSON, calendário de estreias, notificações, rewatch como sessão
   e autenticação multiusuário~~ ✅

**Fora de escopo:** filmes. O modelo inteiro assume série → temporada → episódio, e acomodá-los
exigiria tornar `watch_events.episode_id` polimórfico — mexer na tabela que é a fonte da verdade
do projeto. Não é impossível, é desproporcional ao que um rastreador de séries precisa ser.
