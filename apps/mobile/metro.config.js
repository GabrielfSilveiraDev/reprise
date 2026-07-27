// Metro num monorepo pnpm: por padrão ele só olha para a pasta do app, então o
// `@reprise/shared` (que mora fora dela, como link) simplesmente não seria encontrado.
// As duas linhas abaixo são o que a documentação do Expo pede para monorepo:
// vigiar a raiz e procurar módulos nos dois node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const http = require('node:http');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

/*
 * O alvo é o Android — mas o alvo web do Expo agora sobe, e é o que permite ver as telas do APP
 * sem um aparelho na mão (não há Android SDK nem emulador nesta máquina).
 *
 * <b>As duas coisas que faltavam.</b> O `expo-sqlite` no web é WebAssembly: importa um `.wasm`,
 * que o Metro só resolve se a extensão estiver declarada como ASSET, e roda numa worker que usa
 * OPFS com acesso síncrono — o que exige `SharedArrayBuffer`, que por sua vez exige a página
 * estar isolada por COOP/COEP. Sem os cabeçalhos, a worker sobe e morre na primeira consulta.
 *
 * Nada disso afeta o Android: lá o SQLite é nativo, nenhum `.wasm` é importado, e cabeçalho de
 * dev server não entra no bundle.
 */
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

/*
 * Proxy de `/api` para a API local, só no alvo web.
 *
 * Rodando no navegador, o app deixa de ser um cliente nativo e passa a obedecer à política de
 * mesma origem: `localhost:8082` chamando a API é requisição cruzada, e a API não tem CORS —
 * de propósito, porque o cliente web do Reprise resolve isso com o proxy do Vite. Este é o mesmo
 * arranjo, e traz o mesmo bônus: o token do cadeado é injetado AQUI, no servidor, então ele não
 * precisa ser embutido no bundle que o navegador baixa.
 *
 * No Android nada disto acontece — lá o app fala com a API direto, sem origem para violar.
 */
const API_TARGET = process.env.REPRISE_API_TARGET ?? 'http://localhost:5156';
const API_TOKEN = process.env.REPRISE_API_TOKEN;

function proxyToApi(req, res) {
  const target = new URL(req.url.replace(/^\/api/, ''), API_TARGET);

  const upstream = http.request(
    target,
    {
      method: req.method,
      headers: {
        ...req.headers,
        // O `Host` tem de ser o do destino, senão a API responde para o nome errado.
        host: target.host,
        ...(API_TOKEN ? { 'x-reprise-token': API_TOKEN } : {}),
      },
    },
    (resposta) => {
      res.writeHead(resposta.statusCode ?? 502, resposta.headers);
      resposta.pipe(res);
    },
  );

  // A API fora do ar não pode derrubar o dev server: 502 e a tela do app mostra o erro dela.
  upstream.on('error', (causa) => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ title: 'API inacessível', detail: String(causa) }));
  });

  req.pipe(upstream);
}

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  // Isolamento de origem: é o que habilita `SharedArrayBuffer`, de que a worker do
  // `expo-sqlite` depende. `credentialless` em vez de `require-corp` para as capas do TMDB
  // continuarem carregando — elas vêm sem credencial e não mandam `Cross-Origin-Resource-Policy`.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  if (req.url?.startsWith('/api/')) return proxyToApi(req, res);

  return middleware(req, res, next);
};

module.exports = config;
