// Metro num monorepo pnpm: por padrão ele só olha para a pasta do app, então o
// `@reprise/shared` (que mora fora dela, como link) simplesmente não seria encontrado.
// As duas linhas abaixo são o que a documentação do Expo pede para monorepo:
// vigiar a raiz e procurar módulos nos dois node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// O alvo é o Android. O alvo web do Expo até existe, mas o `expo-sqlite` lá roda em
// WebAssembly e não resolve dentro deste monorepo pnpm — e o cliente web do Reprise já é uma
// aplicação própria, então não há o que ganhar insistindo. Quem quiser voltar a isso precisa
// de `wasm` em `assetExts` e dos cabeçalhos COOP/COEP no dev server.

module.exports = config;
