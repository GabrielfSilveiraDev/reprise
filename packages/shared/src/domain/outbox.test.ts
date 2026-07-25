import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OutboxPlanner } from './outbox.ts';
import type { PendingAction, ProjectableEpisode } from './outbox.ts';

const AGORA = '2026-07-25T20:00:00.000Z';

function ver(clientKey: string, episodeId: number): PendingAction {
  return { kind: 'watch', clientKey, episodeId, watchedAt: AGORA };
}
function desver(clientKey: string, episodeId: number): PendingAction {
  return { kind: 'unwatch', clientKey, episodeId, watchedAt: AGORA };
}
function temporada(clientKey: string, seriesId: number, seasonNumber: number): PendingAction {
  return { kind: 'watch-season', clientKey, seriesId, seasonNumber, watchedAt: AGORA };
}
function ateAqui(
  clientKey: string,
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number,
): PendingAction {
  return { kind: 'watch-up-to', clientKey, seriesId, seasonNumber, episodeNumber, watchedAt: AGORA };
}

/** Uma série de 2 temporadas com 3 episódios cada, nenhuma vista, mais um especial. */
function catalogo(watched: Record<number, number> = {}): ProjectableEpisode[] {
  const episodes: ProjectableEpisode[] = [];
  let id = 1;
  for (const seasonNumber of [1, 2]) {
    for (const episodeNumber of [1, 2, 3]) {
      episodes.push({ id, seriesId: 7, seasonNumber, episodeNumber, watchCount: watched[id] ?? 0 });
      id += 1;
    }
  }
  episodes.push({ id, seriesId: 7, seasonNumber: 0, episodeNumber: 1, watchCount: watched[id] ?? 0 });
  return episodes;
}

describe('OutboxPlanner.planEnqueue', () => {
  it('enfileira a ação quando não há nada para anular', () => {
    const plano = OutboxPlanner.planEnqueue([], ver('k1', 10));
    assert.deepEqual(plano.drop, []);
    assert.equal(plano.add?.clientKey, 'k1');
  });

  it('desmarcar anula uma marcação ainda não enviada, e nada vai para a rede', () => {
    const plano = OutboxPlanner.planEnqueue([ver('k1', 10)], desver('k2', 10));
    assert.deepEqual(plano.drop, ['k1']);
    assert.equal(plano.add, null);
  });

  it('desmarcar sem marcação pendente é enviado de verdade — o evento está no servidor', () => {
    const plano = OutboxPlanner.planEnqueue([ver('k1', 99)], desver('k2', 10));
    assert.deepEqual(plano.drop, []);
    assert.equal(plano.add?.clientKey, 'k2');
  });

  it('anula só a marcação mais recente: duas marcações são um rewatch de verdade', () => {
    const plano = OutboxPlanner.planEnqueue([ver('k1', 10), ver('k2', 10)], desver('k3', 10));
    assert.deepEqual(plano.drop, ['k2']);
    assert.equal(plano.add, null);
  });

  it('não anula através de uma marcação em massa — dali para trás não dá para saber o efeito', () => {
    const fila = [ver('k1', 10), temporada('k2', 7, 1)];
    const plano = OutboxPlanner.planEnqueue(fila, desver('k3', 10));
    assert.deepEqual(plano.drop, []);
    assert.equal(plano.add?.clientKey, 'k3');
  });

  it('marcar duas vezes o mesmo episódio nunca é fundido — é rewatch', () => {
    const plano = OutboxPlanner.planEnqueue([ver('k1', 10)], ver('k2', 10));
    assert.deepEqual(plano.drop, []);
    assert.equal(plano.add?.clientKey, 'k2');
  });
});

describe('OutboxPlanner.project', () => {
  it('sem fila, devolve exatamente o que o servidor disse', () => {
    const contagens = OutboxPlanner.project(catalogo({ 1: 3 }), []);
    assert.equal(contagens.get(1), 3);
    assert.equal(contagens.get(2), 0);
  });

  it('marcar acende o episódio na hora', () => {
    const contagens = OutboxPlanner.project(catalogo(), [ver('k1', 2)]);
    assert.equal(contagens.get(2), 1);
  });

  it('marcar de novo conta como rewatch', () => {
    const contagens = OutboxPlanner.project(catalogo({ 2: 1 }), [ver('k1', 2), ver('k2', 2)]);
    assert.equal(contagens.get(2), 3);
  });

  it('desmarcar nunca leva a contagem abaixo de zero', () => {
    const contagens = OutboxPlanner.project(catalogo(), [desver('k1', 2), desver('k2', 2)]);
    assert.equal(contagens.get(2), 0);
  });

  it('marcar temporada só toca o que ainda não foi visto — igual ao servidor', () => {
    // Ep 1 já visto 2x: a marcação em massa não pode virar um rewatch dele.
    const contagens = OutboxPlanner.project(catalogo({ 1: 2 }), [temporada('k1', 7, 1)]);
    assert.equal(contagens.get(1), 2, 'já visto permanece intocado');
    assert.equal(contagens.get(2), 1);
    assert.equal(contagens.get(3), 1);
    assert.equal(contagens.get(4), 0, 'temporada 2 fica de fora');
  });

  it('marcar temporada respeita o que outra ação da fila já acendeu', () => {
    const contagens = OutboxPlanner.project(catalogo(), [ver('k1', 2), temporada('k2', 7, 1)]);
    assert.equal(contagens.get(2), 1, 'não vira rewatch por causa da massa');
    assert.equal(contagens.get(1), 1);
  });

  it('"até aqui" para no ponto pedido e ignora especiais', () => {
    const contagens = OutboxPlanner.project(catalogo(), [ateAqui('k1', 7, 2, 2)]);
    assert.equal(contagens.get(1), 1);
    assert.equal(contagens.get(3), 1, 'temporada 1 inteira');
    assert.equal(contagens.get(4), 1);
    assert.equal(contagens.get(5), 1, 'T2E2 é o alvo, entra');
    assert.equal(contagens.get(6), 0, 'T2E3 fica de fora');
    assert.equal(contagens.get(7), 0, 'especial nunca entra na ordem linear');
  });

  it('ignora ação de episódio que não está no lote projetado', () => {
    const contagens = OutboxPlanner.project(catalogo(), [ver('k1', 999)]);
    assert.equal(contagens.has(999), false);
    assert.equal(contagens.size, 7);
  });

  it('marcação em massa de outra série não vaza para esta', () => {
    const contagens = OutboxPlanner.project(catalogo(), [temporada('k1', 42, 1)]);
    assert.equal(contagens.get(1), 0);
  });

  it('a ordem da fila é respeitada: marcar, desmarcar, marcar termina em 1', () => {
    const fila = [ver('k1', 2), desver('k2', 2), ver('k3', 2)];
    assert.equal(OutboxPlanner.project(catalogo(), fila).get(2), 1);
  });
});

describe('OutboxPlanner.countForSeries', () => {
  const deEpisodioParaSerie = new Map([
    [1, 7],
    [2, 7],
    [50, 42],
  ]);

  it('conta ações de episódio pela série a que ele pertence', () => {
    const fila = [ver('k1', 1), ver('k2', 50), desver('k3', 2)];
    assert.equal(OutboxPlanner.countForSeries(fila, 7, deEpisodioParaSerie), 2);
    assert.equal(OutboxPlanner.countForSeries(fila, 42, deEpisodioParaSerie), 1);
  });

  it('conta ações em massa pela série que elas nomeiam', () => {
    const fila = [temporada('k1', 7, 1), ateAqui('k2', 42, 1, 5)];
    assert.equal(OutboxPlanner.countForSeries(fila, 7, deEpisodioParaSerie), 1);
    assert.equal(OutboxPlanner.countForSeries(fila, 42, deEpisodioParaSerie), 1);
  });
});
