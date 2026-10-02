# Importação e catálogo

Como o histórico do TV Time entra no Reprise e como o catálogo de séries é completado e mantido em
dia. Os comandos abaixo usam a CLI pelo `dotnet run`; com Docker, troque o prefixo por
`docker compose run --rm cli` (ver [o README](../README.pt-BR.md#início-rápido-com-docker)).

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
- **Falha numa série não para as outras.** Ela vira aviso no log da API (`docker compose logs api`,
  ou o console do `dotnet run`) e é tentada de novo na
  rodada seguinte (hoje é o caso de *Monster*, cujo id no TMDB deixou de existir).

É isso que alimenta a **Agenda** e a faixa **Saindo em breve** da tela inicial. Quem recorta é o
cliente: no web, a `PremiereAgenda` mostra na tela inicial os próximos 8 dias e, na Agenda, tudo —
dia a dia nas duas primeiras semanas, mês a mês depois.
