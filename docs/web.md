# Cliente web (`apps/web`)

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
diz onde a API está. Na imagem Docker (`apps/web/Dockerfile`), quem faz o papel do Vite é o nginx:
serve o build e repassa `/api/*` para o serviço `api` do compose.

## Telas

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

## Três designs

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

## Decisões que vale saber

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

## Organização

```
src/domain     regras puras, em classes e com teste (liberação, progresso, agenda, mapas…)
src/api        cliente da API, sessão, renovação, consultas e mutações
src/features   uma pasta por tela; as vistas por design moram junto (HomeSessao.tsx, CollectionGrade.tsx…)
src/ui         componentes base (botão, pôster, menus, painel lateral…)
src/app        rotas; src/app/shell tem a moldura de cada design
src/styles     index.css (utilitários) e designs.css (as variáveis dos três designs)
```

## Contrato da API

```bash
pnpm --filter @reprise/web api:sync    # com a API de pé: baixa /openapi/v1.json e gera os tipos
pnpm --filter @reprise/web api:types   # só regenera a partir do openapi.json versionado
```

O ASP.NET descreve todo número como `integer | string` (ele aceita número em texto na leitura);
o script normaliza para `number` antes de gerar, porque na escrita a API sempre manda número.

O CI confere o contrato a cada PR: sobe a API, roda o `api:sync` e falha se o `openapi.json` ou
os tipos gerados mudarem. Mexeu num endpoint ou DTO? Rode o `api:sync` e versione o resultado.

## Testes

```bash
pnpm test           # regras do domínio e renovação de sessão (Vitest)
pnpm e2e            # fluxos de ponta a ponta, no desktop e no celular (Playwright)
```

Os testes de ponta a ponta compilam o app (`vite build`), servem o build com `vite preview` e
respondem `/api` com uma API simulada em memória
(`e2e/mock-api.ts`, tipada pelo mesmo schema), com relógio fixo e fuso de São Paulo — não precisam
de banco, de API nem de conta. No Windows usam o Edge instalado; em outro sistema, rode antes
`pnpm --filter @reprise/web exec playwright install chromium`. Com `CAPTURAS=<pasta>` eles também
salvam capturas de todas as telas nos três designs e nos dois temas (120 imagens);
`CAPTURAS_DESIGN=grade` limita a um design.
