// @reprise/shared — cliente de API gerado do OpenAPI, tipos e domínio puro,
// compartilhados entre o cliente web e o app Android.
//
// Os caminhos levam a extensão `.ts` de propósito. Vite e Metro resolvem sem ela, mas o Node
// não — e é o Node, com seu executor de testes nativo, que roda os testes do domínio puro e da
// camada offline. A extensão é o que torna este pacote importável fora de um empacotador.

export * from './api/client.ts';
export type { components, paths } from './api/schema.ts';

export * from './domain/format.ts';
export * from './domain/watchTrack.ts';
export * from './domain/outbox.ts';
export * from './domain/seriesCompletion.ts';
export * from './domain/premiereReminders.ts';
export * from './domain/sessionSummary.ts';
export * from './domain/homeShelf.ts';

export * from './brand/logo.ts';
