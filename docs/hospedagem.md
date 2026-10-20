# Hospedagem gratuita (Neon + Render)

O Reprise no ar, de graça, para abrir de qualquer lugar — no computador e no celular — sem deixar
um PC ligado. São duas contas gratuitas, nenhuma pede cartão:

| Peça | Onde | O que o plano gratuito dá |
|---|---|---|
| Banco (PostgreSQL) | [Neon](https://neon.com) | 1 GB por projeto e 100 horas de computação por mês; desliga depois de 5 minutos parado e liga sozinho, em menos de um segundo, na próxima consulta |
| App (API + site) | [Render](https://render.com) | um serviço com 512 MB; dorme depois de 15 minutos sem acesso e leva **cerca de um minuto** para acordar |

> [!NOTE]
> O minuto de espera é o preço do plano gratuito. Com o app instalado no celular, a tela abre na
> hora (o app guarda a própria casca) e só os dados esperam o servidor acordar.

Os limites mudam de tempos em tempos — confira nas páginas de preço do
[Neon](https://neon.com/pricing) e do [Render](https://render.com/docs/free) antes de contar com
eles. Um histórico de anos de TV Time ocupa poucas dezenas de MB, longe do 1 GB.

## 1. O repositório no seu GitHub

O Render publica a partir de um repositório do GitHub. Se o Reprise não é seu, faça um **fork**
(botão *Fork* no topo da página do projeto): é dele que o Render vai construir, e cada push nele
vira um deploy.

## 2. O banco no Neon

1. Crie a conta em [neon.com](https://neon.com) (dá para entrar com o GitHub).
2. Crie um projeto. Em **Region**, escolha **AWS US East 1 (N. Virginia)** — a mesma região do
   Render no passo seguinte. Cada tela faz várias consultas, e a distância entre a API e o banco
   se soma em cada uma. Deixe a versão do Postgres no padrão.
3. No painel do projeto, clique em **Connect**. **Desligue "Connection pooling"** e copie a URL
   de conexão. Ela tem esta cara:

   ```
   postgresql://neondb_owner:senha@ep-algo-123456.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   Pode colar como veio: o Reprise entende esse formato. Guarde-a — ela é a senha do seu banco.

Por que sem pooling: o pooler do Neon é um PgBouncer em modo transação, que atrapalha a cópia do
banco (passo 4) e não traz nada a um app de uma pessoa só.

## 3. O app no Render

1. Crie a conta em [render.com](https://render.com) entrando com o GitHub.
2. **New → Blueprint**, e escolha o repositório do Reprise. O Render lê o
   [`render.yaml`](../render.yaml) da raiz e mostra o serviço `reprise`.
3. Ele pede um valor: **`ConnectionStrings__Default`** — cole a URL do Neon. O resto já vem
   preenchido (o segredo dos tokens é gerado pelo próprio Render).
4. **Apply**. O primeiro build leva alguns minutos. Na partida, a API cria as tabelas no banco.
5. O endereço aparece no topo do serviço: `https://reprise-xxxx.onrender.com`.

Daí em diante, todo push na `main` que passar no CI é publicado sozinho (`autoDeployTrigger:
checksPass`) — e, com ele, o app do celular, que abre este mesmo site.

## 4. Seus dados no banco novo

Primeiro, ponha a URL do Neon no `.env` da pasta do projeto (crie o arquivo se ele não existir):

```bash
DATABASE_URL=postgresql://neondb_owner:senha@ep-algo-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Pelo `.env`, e não colada nos comandos, a senha do banco não fica no histórico do terminal. Daí em
diante, escolha um dos dois caminhos.

**Você já usava o Reprise no computador** — leve o histórico inteiro, com contas e senhas. Na pasta
do projeto:

```bash
docker compose run --rm copiar-banco
```

A cópia **substitui** as tabelas do Reprise no Neon pelas do banco local, numa transação só: se
falhar no meio, o Neon fica como estava. Pode rodar antes ou depois do deploy no Render. Depois,
entre no endereço do Render com o mesmo usuário e senha de sempre.

**Começando do zero** — crie a sua conta no banco da nuvem:

```bash
docker compose run --rm cli migrate
docker compose run --rm cli passwd --email me@reprise.local --user seunome
```

O `passwd` pergunta a senha, sem mostrá-la. Com o `DATABASE_URL` no `.env`, ela vale para o banco da
nuvem — é o mesmo comando para trocar a senha do site depois.

Com o `DATABASE_URL` no `.env`, **todo** o Reprise local passa a usar o banco da nuvem — o app em
`localhost:8080` e a CLI (importar o TV Time, `enrich`…). É o que se quer depois da cópia: um
histórico só, o mesmo no computador, no site e no celular, em vez de dois que se afastam. É assim
também que vários computadores usam o mesmo histórico. O banco local fica intocado, como estava no
momento da cópia; apague a linha para voltar a ele.

## 5. Ajustes opcionais

No Render, em **Environment**, no painel do serviço (cada mudança reinicia o app):

| Variável | Para quê |
|---|---|
| `Tmdb__ApiKey` | busca de séries novas e catálogo que se atualiza sozinho. [Chave gratuita do TMDB](https://www.themoviedb.org/settings/api) |
| `Api__AccessToken` | **cadeado**: nem a tela de login responde sem esta chave. Gere uma com `openssl rand -hex 32`; o site pede a chave uma vez por aparelho |
| `Android__CertFingerprints` | tira a barra de endereço do app Android — ver [App no celular](android.md) |
| `Jwt__AllowRegistration` | `true` abre o cadastro pela tela. Fechado é o padrão: numa instância pública, aberto é porta aberta |

> [!TIP]
> Recomendo ligar o cadeado. O endereço `onrender.com` é público e acaba aparecendo (no APK, por
> exemplo); com o cadeado, quem não tem a chave não chega nem à tela de login.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| A página do Render fica carregando por um minuto | O serviço estava dormindo. É normal no plano gratuito |
| Deploy falha com `Format of the initialization string` | A URL do banco foi colada com espaço ou aspas. Cole de novo, só a URL |
| Deploy falha com erro de SSL/conexão | Confira se a URL tem `?sslmode=require` e se é a sem pooling (o host não tem `-pooler`) |
| "Usuário ou senha incorretos" no site hospedado | A conta existe só no banco local: faça o passo 4 |
| O app parou de responder no fim do mês | Acabaram as 100 horas do Neon ou as 750 do Render no mês; voltam no dia 1º. Ver o uso nos painéis |

Os logs da API ficam em **Logs**, no painel do serviço no Render.

## Por que assim

- **Neon, e não o Postgres do Render**: o banco gratuito do Render é apagado 30 dias depois de
  criado. O Supabase pausa o projeto depois de uma semana sem uso e só volta por ação manual.
- **Um serviço só**: a API serve também o site (ver `WebClientHosting`, na API). Dois serviços
  gratuitos dormiriam e acordariam cada um por conta própria, e o site precisaria de CORS para
  falar com a API em outro endereço.
- **Migração na partida**: o Render gratuito não tem passo de pré-deploy. Com uma instância só,
  a API migrar o banco ao subir (`Database__MigrateOnStartup`) é seguro. No docker-compose, quem
  migra continua sendo o serviço `migrate`.
