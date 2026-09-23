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
| `apps/web` | React 19 + TypeScript + Vite + TanStack Router/Query + Tailwind | cliente web (tipos gerados do OpenAPI da API) |

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

A API não migra o banco sozinha. Depois de puxar código com migração nova (a mais recente é
`RewatchDismissal`, a coluna que guarda quando uma revisão foi tirada da fila), aplique:

```bash
dotnet ef database update --project apps/api/Reprise.Infrastructure --startup-project apps/api/Reprise.Infrastructure
```

A conexão vem de `ConnectionStrings__Default` no ambiente (a do `.env`); sem ela, o padrão do
docker-compose.

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

## Abrindo com um clique (Windows)

`scripts/subir-reprise.ps1` sobe banco, API e web **em segundo plano** e abre o Reprise numa
**janela própria** do navegador. Fechar essa janela encerra tudo: API, web, o container do
Postgres e — se foi o launcher que ligou — o Docker Desktop. É o que o atalho do Desktop executa.

```powershell
.\scripts\subir-reprise.ps1                  # o que o atalho faz
.\scripts\subir-reprise.ps1 -SemNavegador    # sobe tudo e sai, sem janela e sem encerrar
.\scripts\subir-reprise.ps1 -Parar           # derruba o que estiver de pé
```

- **Nenhum terminal aparece.** O atalho chama `conhost.exe --headless`; API e web sobem sem
  janela. Enquanto o Reprise está aberto há um ícone na bandeja, com "Abrir outra janela" e
  "Encerrar o Reprise". A saída de cada serviço vai para `%LOCALAPPDATA%\Reprise\logs`, e a
  execução anterior fica guardada como `*.anterior.log`.
- **A janela tem perfil próprio** (`%LOCALAPPDATA%\Reprise\navegador`). É o que permite saber que
  ela fechou — uma aba no navegador de sempre não tem processo próprio para observar. Por isso o
  login é feito uma vez nessa janela, que não compartilha sessão com o navegador de uso.
- **O Docker só é desligado se o launcher o ligou.** Se ele já estava de pé por causa de outro
  projeto, só o container do Reprise para.
- **Os sockets do Docker são afastados antes de ligá-lo.** Nesta máquina o Docker Desktop deixa
  para trás sockets que o Windows não deixa apagar (erro 1920), e toda partida depois de um
  desligamento quebrava tentando removê-los. O launcher move `Docker\run` e
  `docker-secrets-engine` para `*.antiga-*` antes de ligar o Docker; essas pastas só podem ser
  apagadas depois de reiniciar o Windows, e o launcher tenta a cada partida. Se o Docker quebrar
  mesmo assim, a mensagem de erro traz o que ele registrou.
- **Portas fixas:** web na 5173 e API na 5156, sem plano B. Porta ocupada por outro programa
  vira erro com o nome dele, em vez de o Vite subir calado em outra porta.
- **O Vite é chamado direto, sem `pnpm dev`.** O `pnpm` confere as dependências antes de rodar e
  pode disparar um `install` que *pergunta* antes de mexer no `node_modules` — sem terminal
  visível, ninguém responde e o web nunca sobe. Depois de mudar dependências, rode `pnpm install`.

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

### Sinopse dos episódios

```bash
dotnet run --project apps/api/Reprise.Importer -- resumos           # só os episódios ainda sem
dotnet run --project apps/api/Reprise.Importer -- resumos --force   # reconsulta todos
```

Comando à parte pelo mesmo motivo do `paises`: o campo nasceu depois dos dados, e o `enrich
--force` resolveria reprocessando o catálogo inteiro — inclusive o realinhamento de temporadas —
para preencher uma coluna. Daqui para a frente o `enrich` já traz a sinopse junto do nome e da
imagem, então isto é só para o acervo antigo.

A cobertura para no que o TMDB tem: no acervo real, **7.525 de 9.316 episódios (80,8%)**. Os
demais não têm texto lá, e o painel de detalhes diz isso em vez de mostrar um bloco vazio.

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

## O catálogo se atualiza sozinho

Com a chave do TMDB configurada, a API mantém em dia as séries que alguém acompanha e que o TMDB
não dá por encerradas. Ela confere na partida e depois de hora em hora, e reconsulta no TMDB e no
TVmaze cada série cuja última consulta tem mais de **12 horas**. É o mesmo caminho do `enrich` e do
`agenda`, inclusive a regra de nunca apagar episódio. Ver `CatalogRefresh`.

Existe porque a CLI só roda quando alguém lembra dela. Em setembro de 2026 o catálogo estava sem
a volta de Silo (julho de 2027), sem duas temporadas já datadas e sem o resumo do próximo Dark
Matter, e a faixa de estreias da tela inicial só enxergava o que o catálogo sabia.

- **Série encerrada ou cancelada fica de fora**, porque não ganha episódio. Se uma delas voltar,
  rode o `enrich --force`.
- **O marco é `series.updated_at`**, que só o enriquecimento escreve. Se a API fechar no meio de
  uma rodada, a próxima retoma de onde parou.
- **Falha numa série não para as outras.** Ela vira aviso no `api.log` e é tentada de novo na
  rodada seguinte (hoje é o caso de *Monster*, cujo id no TMDB deixou de existir).

É isso que alimenta a **Agenda** e a faixa **Saindo em breve** da tela inicial. Quem recorta é o
cliente: no web, a `PremiereAgenda` mostra na tela inicial os próximos 8 dias e, na Agenda, tudo —
dia a dia nas duas primeiras semanas, mês a mês depois.

## Cliente web (`apps/web`)

Refeito do zero em setembro de 2026, a partir só da API. React 19 + TypeScript + Vite, e uma
biblioteca para cada problema que já tem solução boa:

| Peça | Biblioteca | Por quê |
|---|---|---|
| Rotas | TanStack Router | filtros, ano e episódio aberto moram na URL, tipados — link colado abre a mesma tela |
| Dados | TanStack Query | cache, pré-busca ao passar o mouse e marcação otimista com "Desfazer" |
| Cliente da API | openapi-fetch + openapi-typescript | tipos gerados do contrato da API; nenhum DTO redeclarado à mão |
| Estilo | Tailwind CSS 4 + tailwind-merge | tokens próprios em variáveis CSS: três designs, cada um em claro e escuro |
| Componentes | Radix UI | menus, diálogos, abas e interruptores acessíveis por teclado e leitor de tela |
| Gráficos | Recharts | colunas por mês e por ano; o calendário e o mapa de episódios são SVG/CSS próprios |
| Busca rápida | cmdk | Ctrl+K (ou `/`) para pular para qualquer série ou tela |
| Datas e avisos | date-fns (pt-BR), sonner | |

```bash
pnpm install
pnpm dev            # http://localhost:5173 — a API precisa estar em http://localhost:5156
```

O navegador fala só com o Vite, que repassa `/api/*` para a API: a sessão nunca cruza origem e a
API não precisa de CORS. `REPRISE_API_URL` troca o destino; num build de produção, `VITE_API_URL`
diz onde a API está.

### Telas

- **Agora** — a fila: o próximo episódio de cada série vista no último mês, com "Assisti" a um
  toque e "Desfazer" no aviso. **Revisões entram também**, em qualquer estado (inclusive
  Concluída): se a última coisa que você fez numa série foi remarcar um episódio já visto, o
  próximo é o seguinte a ele, com o selo "Revendo" — e um X tira a revisão da fila até você
  remarcar outro episódio dela. Abaixo, as estreias dos próximos 8 dias e, recolhidas, as séries
  paradas e as nunca começadas.
- **Acervo** — pôsteres com progresso em três partes (visto · lançado e não visto · por lançar),
  filtro por estado, busca sem acento e ordenação. Quando uma série encerrada foi vista por inteiro,
  sugere mover para Concluídas — sugestão, nunca ação automática.
- **Série** — o **mapa de episódios**: uma linha por temporada, um quadrado por episódio, a cor
  pela quantidade de vezes que foi visto. Abaixo, a lista por temporada (marcar, rever, marcar em
  outra data, marcar até aqui, marcar a temporada) e "quando você viu": cada vez que a série foi
  percorrida, numa régua de tempo.
- **Agenda** — tudo o que vai sair nas séries em "Assistindo", no fuso de quem olha.
- **Números** — tempo total, sequências, calendário do ano, colunas por mês e por ano, e onde o
  tempo foi. Cada gráfico tem a tabela com os números por trás.
- **Adicionar**, **Conta** (design e tema, exportar os dados, sair) e as telas de entrada (login
  por e-mail ou usuário, cadastro, código de validação; a chave do servidor só aparece quando o
  cadeado da API está ligado).

### Três designs

O mesmo app em três desenhos, escolhidos em **Conta → Aparência** (ou pela paleta, Ctrl+K →
"design"). A escolha é do navegador, como o tema, e cada design tem claro e escuro:

| Design | Ideia | Tipografia | Forma |
|---|---|---|---|
| **Brasa** | quente e editorial | Bricolage Grotesque estreitada + Inter | barra lateral, cartões arredondados, laranja |
| **Sessão** | sala escura de cinema | Instrument Serif + Instrument Sans | letreiro no topo, palco com o pôster desfocado, faixas de cartazes, dourado |
| **Grade** | grade de programação de jornal | Geist + Geist Mono | faixa de transmissão, abas numeradas, tabelas com fios, nada arredondado, azul-sinal |

Como é montado, do mais barato ao mais caro:

1. **Variáveis.** `src/styles/designs.css` tem um conjunto completo de variáveis por design e tema
   (cores, fontes, voz dos títulos, raios). Os raios têm nome de papel — `rounded-card`,
   `rounded-control`, `rounded-poster`, `rounded-panel`, `rounded-pill` — porque na Sessão o botão é
   pílula e o pôster quase reto, e na Grade tudo é reto. `node scripts/check-contrast.mjs` confere o
   contraste das seis paletas lendo o próprio CSS.
2. **Variantes.** `grade:` e `sessao:` para o pouco que é forma e não valor (um fio só na Grade).
3. **Vistas.** Onde o design muda a estrutura — a moldura, a tela inicial, a coleção do acervo, a
   capa da série e a arte do login — cada tela tem um **modelo** (dados e regras, um só) e uma
   **vista por design** (`HomeBrasa`, `HomeSessao`, `HomeGrade`…), escolhida por `useDesigned`.
   O `Record` obriga a declarar as três: um design novo que esqueça uma tela não compila.

Agenda, Números, Buscar e Conta são as mesmas telas nos três, vestidas pelas variáveis.

### Decisões que vale saber

- **"Libera às 04:00", e não "estreia às 04:00".** O `releasesAt` da API só é horário de exibição
  na TV aberta; no streaming é uma estimativa que erra para depois, nunca para antes. A interface
  diz o que é verdade nos dois casos: a partir daquele instante o episódio pode ser marcado.
- **A sinopse do episódio é spoiler.** Nunca aparece na lista; no painel de detalhes vem borrada
  até um clique, a não ser que o episódio já tenha sido visto.
- **Clicar num episódio já visto abre opções**, não desmarca: rever (+1) e remover a última
  exibição são coisas diferentes no Reprise.
- **Uma renovação de sessão por vez, entre abas.** O refresh token é rotativo; quatro consultas com
  o token vencido esperam a mesma renovação, e outra aba que já renovou tem a sessão adotada (Web
  Locks + evento `storage`). Sem isso, abrir a tela inicial com o token vencido deslogaria a pessoa.

### Organização

```
src/domain     regras puras, em classes e com teste (liberação, progresso, agenda, mapas…)
src/api        cliente da API, sessão, renovação, consultas e mutações
src/features   uma pasta por tela; as vistas por design moram junto (HomeSessao.tsx, CollectionGrade.tsx…)
src/ui         componentes base (botão, pôster, menus, painel lateral…)
src/app        rotas; src/app/shell tem a moldura de cada design
src/styles     index.css (utilitários) e designs.css (as variáveis dos três designs)
```

### Contrato da API

```bash
pnpm --filter @reprise/web api:sync    # com a API de pé: baixa /openapi/v1.json e gera os tipos
pnpm --filter @reprise/web api:types   # só regenera a partir do openapi.json versionado
```

O ASP.NET descreve todo número como `integer | string` (ele aceita número em texto na leitura);
o script normaliza para `number` antes de gerar, porque na escrita a API sempre manda número.

### Testes

```bash
pnpm test           # regras do domínio e renovação de sessão (Vitest)
pnpm e2e            # fluxos de ponta a ponta, no desktop e no celular (Playwright)
```

Os testes de ponta a ponta sobem o Vite e respondem `/api` com uma API simulada em memória
(`e2e/mock-api.ts`, tipada pelo mesmo schema), com relógio fixo e fuso de São Paulo — não precisam
de banco, de API nem de conta. No Windows usam o Edge instalado; em outro sistema, rode antes
`pnpm --filter @reprise/web exec playwright install chromium`. Com `CAPTURAS=<pasta>` eles também
salvam capturas de todas as telas nos três designs e nos dois temas (120 imagens);
`CAPTURAS_DESIGN=grade` limita a um design.

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
não significam nada fora desta instalação. No web, Conta e dados → Baixar tudo em JSON.

## Roadmap

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
