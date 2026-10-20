# App no celular

O Reprise vira app no celular de dois jeitos. Os dois abrem em tela cheia, com ícone próprio, sempre
no design **Brasa**, e **se atualizam sozinhos**: o app é o próprio site hospedado, então cada
deploy no Render já chega ao celular na próxima vez que ele for aberto. Os dois precisam do Reprise
hospedado antes — ver [Hospedagem](hospedagem.md).

| | Instalar pelo navegador (PWA) | APK do Android |
|---|---|---|
| Aparelhos | Android e iPhone | Android |
| Instalação | um toque, no navegador | baixar o APK do GitHub e abrir |
| Atualização do app | sozinha, a cada deploy | sozinha, a cada deploy |
| Configuração | nenhuma | uma vez: chave de assinatura e um workflow |

**Na dúvida, comece pelo navegador**: é o mesmo app, sem configurar nada. O APK é para quem quer o
Reprise na lista de apps como um app "de verdade", instalado por arquivo.

> [!NOTE]
> Por que não na Play Store: publicar lá custa US$ 25 e, para conta pessoal nova, exige um teste
> fechado com 12 pessoas durante 14 dias antes de o app ir ao ar. A App Store custa US$ 99 por ano
> e só compila em Mac. O APK e o PWA chegam ao mesmo resultado sem nada disso.

## Pelo navegador (Android e iPhone)

Abra o endereço do seu Reprise (`https://reprise-xxxx.onrender.com`) e entre na conta.

- **Android (Chrome)**: menu ⋮ → **Instalar app** (ou **Adicionar à tela inicial**).
- **iPhone (Safari)**: botão de compartilhar → **Adicionar à Tela de Início**.

Pronto: o ícone do Reprise aparece junto dos outros apps.

## APK do Android

O APK é uma *Trusted Web Activity*: o jeito que o Google recomenda para empacotar um app web. Ele
abre o seu Reprise pelo Chrome do celular, em tela cheia e sem barra de endereço. Quem compila é o
GitHub Actions, de graça. A configuração abaixo é feita uma vez só.

### 1. A chave de assinatura

Todo APK é assinado, e o Android só aceita atualizar um app com um APK assinado pela **mesma
chave**. Gere a sua na pasta do projeto (precisa só do Docker):

```bash
docker run --rm -v "${PWD}:/repo" -w /repo --entrypoint node ghcr.io/googlechromelabs/bubblewrap:1.25.0 apps/android/gerar-chave.mjs
```

O comando funciona igual no PowerShell, no macOS e no Linux. No Git Bash do Windows, rode antes
`export MSYS_NO_PATHCONV=1` — sem isso o Git Bash reescreve o `/repo` como caminho do Windows.

Ele cria `apps/android/reprise.keystore` (fora do Git) e mostra duas coisas: a **senha** e a
**impressão SHA-256** do certificado. Guarde a chave e a senha num gerenciador de senhas: sem elas,
nenhum APK novo atualiza o instalado.

### 2. O que o GitHub precisa saber

No seu repositório no GitHub: **Settings → Secrets and variables → Actions**.

Na aba **Secrets**, crie:

| Nome | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | o conteúdo inteiro de `apps/android/reprise.keystore.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | a senha mostrada no passo 1 |

Na aba **Variables**, crie:

| Nome | Valor |
|---|---|
| `REPRISE_URL` | o endereço do seu Reprise no Render, com `https://` |
| `ANDROID_SDK_LICENSE` | `aceita` — leia antes a [licença do Android SDK](https://developer.android.com/studio/terms): o build instala as ferramentas do SDK, e elas só instalam com a licença aceita |

Com o [GitHub CLI](https://cli.github.com/), dá para fazer o mesmo pelo terminal:

```bash
gh secret set ANDROID_KEYSTORE_BASE64 --body "$(cat apps/android/reprise.keystore.txt)"
gh secret set ANDROID_KEYSTORE_PASSWORD
gh variable set REPRISE_URL --body "https://reprise-xxxx.onrender.com"
```

No PowerShell, troque `"$(cat …)"` por `(Get-Content apps/android/reprise.keystore.txt -Raw)`. A
variável `ANDROID_SDK_LICENSE` fica para você criar depois de ler a licença.

### 3. Tirar a barra de endereço

O Chrome só abre o app sem barra de endereço quando o site prova que o APK é do mesmo dono. No
Render, em **Environment**, crie a variável **`Android__CertFingerprints`** com a impressão SHA-256
do passo 1 (`AB:CD:…`). O site passa a publicá-la em `/.well-known/assetlinks.json`.

Sem esse passo o app funciona do mesmo jeito, só que com uma barra de endereço fina no topo.

### 4. Compilar e instalar

1. No GitHub: **Actions → App Android → Run workflow**. Leva uns 5 minutos.
2. O APK sai em **Releases** (`App Android 1.0.N`). Abra a página pelo celular e toque no
   `reprise-1.0.N.apk`.
3. O Android pede para permitir instalação de apps do navegador. Permita só para ele.

### Atualizações

- **O conteúdo do app** (telas, correções, tudo o que muda no código do site) se atualiza sozinho
  a cada deploy, sem baixar nada.
- **O APK em si** só muda quando muda o endereço, o ícone, as cores ou o nome. Para receber essas
  versões sem lembrar de conferir, instale o [Obtainium](https://github.com/ImranR98/Obtainium):
  **Add App**, cole o endereço do seu repositório no GitHub e, em filtro de tag, use `android-v`. Ele
  avisa e instala as versões novas.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| O app abre com barra de endereço | A impressão em `Android__CertFingerprints` não bate com a chave que assinou o APK, ou o Chrome ainda guarda a resposta antiga: confira o valor, desinstale e instale o APK de novo |
| "App não instalado" ao atualizar | O APK novo foi assinado com outra chave. Desinstale o anterior (o histórico fica no servidor, nada se perde) |
| O workflow para em "Confere a configuração" | Falta um dos segredos ou variáveis do passo 2; a mensagem diz qual |
| A primeira abertura demora um minuto | O servidor gratuito estava dormindo (ver [Hospedagem](hospedagem.md)) |

## Como é feito

- O APK é gerado pelo [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), a ferramenta
  do Google para Trusted Web Activity, rodando na imagem Docker oficial dele (JDK e Android SDK
  inclusos) — a mesma no CI e na sua máquina. O roteiro é `apps/android/compilar-apk.mjs`.
- O PWA é o [vite-plugin-pwa](https://vite-pwa-org.netlify.app/): manifesto, ícones (`apps/web/public`,
  gerados por `pnpm --filter @reprise/web pwa:icons`) e um service worker que guarda a casca do app
  e se atualiza sozinho. Os dados (`/api`) nunca passam pelo cache.
- O app é sempre Brasa: `AppMode` (em `apps/web/src/lib`) reconhece quando o Reprise roda instalado
  e trava o design. No navegador, os três designs continuam à escolha.
