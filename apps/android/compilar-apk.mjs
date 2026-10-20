// Compila o APK do Reprise — uma Trusted Web Activity: o site hospedado aberto pelo Chrome em tela
// cheia, sem barra de endereço. Como o APK só aponta para o site, cada deploy do site já é uma
// atualização do app; o APK em si só muda quando muda o endereço, o ícone ou as cores.
//
// Roda DENTRO da imagem do Bubblewrap (a ferramenta do Google para empacotar app web), que já traz
// JDK e Android SDK — a mesma no CI e na sua máquina. Passo a passo em docs/android.md:
//
//   docker run --rm -v "${PWD}:/repo" -w /repo -e REPRISE_URL=https://seu-reprise.onrender.com \
//     -e BUBBLEWRAP_KEYSTORE_PASSWORD=... -e BUBBLEWRAP_KEY_PASSWORD=... \
//     --entrypoint node ghcr.io/googlechromelabs/bubblewrap:1.25.0 apps/android/compilar-apk.mjs
//
// Variáveis:
//   REPRISE_URL                    endereço do Reprise hospedado (obrigatório)
//   BUBBLEWRAP_KEYSTORE_PASSWORD   senha da chave de assinatura (obrigatório; a do par gerar-chave.mjs)
//   BUBBLEWRAP_KEY_PASSWORD        idem, da entrada da chave (o gerar-chave usa a mesma)
//   ANDROID_KEYSTORE               caminho da chave       (padrão: apps/android/reprise.keystore)
//   ANDROID_KEY_ALIAS              nome da entrada        (padrão: reprise)
//   ANDROID_PACKAGE_ID             pacote do app          (padrão: o de AndroidAppLinks, na API)
//   APP_VERSION_CODE               número da versão, sobe a cada APK (padrão: 1)
//   APP_VERSION_NAME               versão para gente      (padrão: 1.0.<código>)
//   ANDROID_SDK_LICENSE            "aceita": você aceita a licença do Android SDK do Google
//                                  (https://developer.android.com/studio/terms), sem a qual o SDK
//                                  não instala as ferramentas de build. Obrigatório.

import { spawn, execFileSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ICONS = resolve(HERE, '../web/public')
const OUT = resolve(HERE, 'dist')

/** O que vem do ambiente, validado de uma vez — um erro de configuração aparece antes do Gradle. */
class Config {
  static fromEnv(env = process.env) {
    const fail = (message) => {
      throw new Error(message)
    }
    const url = new URL(env.REPRISE_URL || fail('Defina REPRISE_URL com o endereço do Reprise hospedado (https://…).'))
    if (url.protocol !== 'https:') fail('REPRISE_URL precisa ser https: o Android só confia no app com o site em HTTPS.')
    const versionCode = Number(env.APP_VERSION_CODE || 1)
    if (!Number.isInteger(versionCode) || versionCode < 1) fail(`APP_VERSION_CODE inválido: ${env.APP_VERSION_CODE}`)
    if (!env.BUBBLEWRAP_KEYSTORE_PASSWORD) fail('Defina BUBBLEWRAP_KEYSTORE_PASSWORD (a senha da chave de assinatura).')
    // Aceitar a licença é decisão de quem compila, não deste script: ele só repassa o "sim" ao
    // Bubblewrap quando a pessoa disse sim, por esta variável.
    if (env.ANDROID_SDK_LICENSE !== 'aceita')
      fail(
        'O Android SDK só instala as ferramentas de build com a licença dele aceita. Leia-a em ' +
          'https://developer.android.com/studio/terms e, se concordar, defina ANDROID_SDK_LICENSE=aceita.',
      )
    // O gerar-chave.mjs usa a mesma senha para o arquivo e para a entrada; sem a segunda, o
    // Bubblewrap pararia perguntando — e aqui não há quem responda.
    env.BUBBLEWRAP_KEY_PASSWORD ||= env.BUBBLEWRAP_KEYSTORE_PASSWORD

    return {
      host: url.host,
      packageId: env.ANDROID_PACKAGE_ID || 'io.github.gabrielfsilveiradev.reprise',
      versionCode,
      versionName: env.APP_VERSION_NAME || `1.0.${versionCode}`,
      keystore: resolve(env.ANDROID_KEYSTORE || join(HERE, 'reprise.keystore')),
      keyAlias: env.ANDROID_KEY_ALIAS || 'reprise',
      keystorePassword: env.BUBBLEWRAP_KEYSTORE_PASSWORD,
    }
  }
}

/**
 * Serve ao Bubblewrap o que ele só aceita por URL: os ícones do repositório (apps/web/public) e um
 * manifesto web. Buscá-los no site hospedado amarraria o build a ele estar no ar e acordado — o
 * Render gratuito leva um minuto para acordar —, e os ícones do repositório são os mesmos que o
 * site serve. Do manifesto o Bubblewrap só aproveita atalhos e tratadores de protocolo e de arquivo,
 * que o Reprise não tem: um mínimo basta.
 */
class AssetServer {
  #server = createServer((req, res) => {
    const name = basename(new URL(req.url, 'http://x').pathname)
    if (name === 'manifest.webmanifest') {
      res.writeHead(200, { 'Content-Type': 'application/manifest+json' })
      res.end(JSON.stringify({ name: 'Reprise', short_name: 'Reprise', start_url: '/', display: 'standalone', icons: [] }))
      return
    }
    const file = join(ICONS, name)
    createReadStream(file)
      .on('error', () => res.writeHead(404).end())
      .on('open', () => res.writeHead(200, { 'Content-Type': 'image/png' }))
      .pipe(res)
  })

  async start() {
    await new Promise((ok) => this.#server.listen(0, '127.0.0.1', ok))
    return this
  }

  url(name) {
    return `http://127.0.0.1:${this.#server.address().port}/${name}`
  }

  stop() {
    this.#server.close()
  }
}

/** O projeto Android gerado pelo Bubblewrap, numa pasta temporária, e o APK assinado que sai dele. */
class TwaBuild {
  constructor(config) {
    this.config = config
  }

  /**
   * O twa-manifest.json, que descreve o app para o Bubblewrap. As cores são as da Brasa — o app é
   * sempre Brasa (apps/web/src/lib/AppMode.ts): o fundo da abertura e das barras do sistema,
   * no claro e no escuro, iguais ao fundo do app.
   */
  manifest(icons) {
    const { host, packageId, versionCode, versionName, keystore, keyAlias } = this.config
    const light = '#F6F4F0'
    const dark = '#121110'
    return {
      packageId,
      host,
      name: 'Reprise',
      launcherName: 'Reprise',
      display: 'standalone',
      orientation: 'portrait',
      themeColor: light,
      themeColorDark: dark,
      navigationColor: light,
      navigationColorDark: dark,
      navigationDividerColor: light,
      navigationDividerColorDark: dark,
      backgroundColor: light,
      enableNotifications: false,
      startUrl: '/',
      iconUrl: icons.url('pwa-512x512.png'),
      maskableIconUrl: icons.url('maskable-icon-512x512.png'),
      splashScreenFadeOutDuration: 300,
      signingKey: { path: keystore, alias: keyAlias },
      appVersionName: versionName,
      appVersionCode: versionCode,
      appVersion: versionName,
      shortcuts: [],
      generatorApp: 'bubblewrap-cli',
      webManifestUrl: icons.url('manifest.webmanifest'),
      fullScopeUrl: `https://${host}/`,
      // Sem Chrome com suporte a TWA, abre como aba personalizada — funciona, só que com a barra.
      fallbackType: 'customtabs',
      enableSiteSettingsShortcut: true,
      isChromeOSOnly: false,
      isMetaQuest: false,
      minSdkVersion: 24,
      features: {},
      alphaDependencies: { enabled: false },
      fingerprints: [],
      additionalTrustedOrigins: [],
      retainedBundles: [],
      protocolHandlers: [],
      fileHandlers: [],
      displayOverride: [],
    }
  }

  async run() {
    const icons = await new AssetServer().start()
    try {
      const work = await mkdtemp(join(tmpdir(), 'reprise-twa-'))
      await writeFile(join(work, 'twa-manifest.json'), JSON.stringify(this.manifest(icons), null, 2))

      // `update` gera o projeto Android a partir do twa-manifest.json; `build` compila e assina.
      await TwaBuild.bubblewrap(work, ['update', '--skipVersionUpgrade'])
      await TwaBuild.bubblewrap(work, ['build', '--skipPwaValidation'])

      await mkdir(OUT, { recursive: true })
      const apk = join(OUT, `reprise-${this.config.versionName}.apk`)
      await copyFile(join(work, 'app-release-signed.apk'), apk)

      const fingerprint = this.fingerprint()
      await writeFile(join(OUT, 'impressao-sha256.txt'), fingerprint + '\n')
      console.log(`\nAPK: ${apk}`)
      console.log(`Impressão SHA-256 do certificado (Android__CertFingerprints no Render): ${fingerprint}`)
    } finally {
      icons.stop()
    }
  }

  /** A impressão digital que o site publica em /.well-known/assetlinks.json (ver AndroidAppLinks). */
  fingerprint() {
    const { keystore, keyAlias, keystorePassword } = this.config
    const listing = execFileSync('keytool', ['-list', '-v', '-keystore', keystore, '-alias', keyAlias, '-storepass', keystorePassword], {
      encoding: 'utf8',
    })
    const match = listing.match(/SHA256:\s*([0-9A-F:]{95})/)
    if (!match) throw new Error('Não achei a impressão SHA-256 na saída do keytool.')
    return match[1]
  }

  static bubblewrap(cwd, args) {
    return new Promise((ok, fail) => {
      // Sem terminal. As senhas vêm do ambiente; a única pergunta que sobra é a da licença do
      // Android SDK, na primeira instalação das ferramentas de build — e quem chegou aqui já disse
      // sim a ela (ANDROID_SDK_LICENSE, conferida em Config). Uma vez aceita, o sdkmanager grava o
      // aceite no SDK e o Gradle instala o resto sem perguntar.
      const child = spawn('bubblewrap', args, { cwd, stdio: ['pipe', 'inherit', 'inherit'] })
      child.stdin.on('error', () => {})
      child.stdin.end('y\n'.repeat(10))
      child.on('error', fail)
      child.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`bubblewrap ${args[0]} terminou com código ${code}.`))))
    })
  }
}

try {
  await new TwaBuild(Config.fromEnv()).run()
} catch (error) {
  console.error(`\n${error.message}`)
  process.exit(1)
}
