// Gera a chave que assina o APK do Reprise. Uma vez só, por quem hospeda: o Android só aceita
// atualizar um app com um APK assinado pela MESMA chave — perdeu a chave, o próximo APK exige
// desinstalar o anterior. Guarde o arquivo e a senha num gerenciador de senhas.
//
// Roda na imagem do Bubblewrap, que já traz o keytool (passo a passo em docs/android.md):
//
//   docker run --rm -v "${PWD}:/repo" -w /repo --entrypoint node \
//     ghcr.io/googlechromelabs/bubblewrap:1.25.0 apps/android/gerar-chave.mjs
//
// Sai em apps/android/ (fora do Git, pelo .gitignore):
//   reprise.keystore          a chave
//   reprise.keystore.txt      a chave em base64 — o conteúdo do segredo ANDROID_KEYSTORE_BASE64
// e no terminal: a senha (segredo ANDROID_KEYSTORE_PASSWORD) e a impressão SHA-256 do certificado
// (Android__CertFingerprints no Render).

import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

class SigningKey {
  static ALIAS = 'reprise'

  constructor(path = join(HERE, 'reprise.keystore')) {
    this.path = path
  }

  async create() {
    // Recusar é melhor do que sobrescrever: a chave antiga é a única que atualiza os apps já instalados.
    if (existsSync(this.path)) throw new Error(`${this.path} já existe. Apague-o à mão se quer mesmo uma chave nova.`)

    // Só letras e números: a senha vai parar em variável de ambiente e em segredo do GitHub, e
    // nenhum shell no caminho deve ter o que interpretar nela.
    const password = randomBytes(24).toString('base64url').replace(/[-_]/g, '').slice(0, 28)
    execFileSync('keytool', [
      '-genkeypair', '-keystore', this.path, '-alias', SigningKey.ALIAS,
      '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
      '-dname', 'CN=Reprise', '-storetype', 'PKCS12',
      '-storepass', password, '-keypass', password,
    ], { stdio: 'ignore' })

    await writeFile(`${this.path}.txt`, (await readFile(this.path)).toString('base64') + '\n')
    return { password, fingerprint: this.fingerprint(password) }
  }

  fingerprint(password) {
    const listing = execFileSync('keytool', ['-list', '-v', '-keystore', this.path, '-alias', SigningKey.ALIAS, '-storepass', password], {
      encoding: 'utf8',
    })
    return listing.match(/SHA256:\s*([0-9A-F:]{95})/)?.[1] ?? '(não encontrada — rode keytool -list -v)'
  }
}

try {
  const key = new SigningKey()
  const { password, fingerprint } = await key.create()
  console.log(`Chave criada: apps/android/reprise.keystore (e o base64 em apps/android/reprise.keystore.txt)

Senha (segredo ANDROID_KEYSTORE_PASSWORD no GitHub):
  ${password}

Impressão SHA-256 (variável Android__CertFingerprints no Render):
  ${fingerprint}

Guarde a chave e a senha num gerenciador de senhas: sem elas, nenhum APK novo atualiza o instalado.`)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
