import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SeriesCompletion } from './seriesCompletion.ts';

describe('SeriesCompletion', () => {
  it('distingue "acabou" de "em dia" — a razão de esta classe existir', () => {
    const encerrada = SeriesCompletion.of({
      productionStatus: 'Ended',
      episodesTotal: 208,
      episodesWatched: 208,
    });
    const emProducao = SeriesCompletion.of({
      productionStatus: 'Returning Series',
      episodesTotal: 40,
      episodesWatched: 40,
    });

    assert.equal(encerrada.state, 'finished');
    assert.equal(emProducao.state, 'up-to-date');
    // As duas estão em 100%: sem o status da produção seriam indistinguíveis.
    assert.equal(encerrada.ratio, 1);
    assert.equal(emProducao.ratio, 1);
  });

  it('série cancelada também acabou', () => {
    for (const status of ['Canceled', 'Cancelled']) {
      const c = SeriesCompletion.of({ productionStatus: status, episodesTotal: 10, episodesWatched: 10 });
      assert.equal(c.state, 'finished', `${status} deveria contar como encerrada`);
    }
  });

  it('sem status do TMDB, não anuncia "finalizada" — não saber não é o mesmo que acabou', () => {
    for (const status of [null, undefined, '']) {
      const c = SeriesCompletion.of({ productionStatus: status, episodesTotal: 10, episodesWatched: 10 });
      assert.equal(c.state, 'up-to-date');
    }
  });

  it('conta o que falta e concorda o singular', () => {
    const um = SeriesCompletion.of({ productionStatus: 'Ended', episodesTotal: 10, episodesWatched: 9 });
    assert.equal(um.state, 'behind');
    assert.equal(um.remaining, 1);
    assert.equal(um.label, 'Falta 1 episódio');

    const varios = SeriesCompletion.of({ productionStatus: 'Ended', episodesTotal: 10, episodesWatched: 6 });
    assert.equal(varios.label, 'Faltam 4 episódios');
  });

  it('série encerrada com episódios faltando NÃO é finalizada', () => {
    const c = SeriesCompletion.of({ productionStatus: 'Ended', episodesTotal: 208, episodesWatched: 184 });
    assert.equal(c.state, 'behind', 'a produção acabou, mas você não');
    assert.equal(c.remaining, 24);
  });

  it('nada visto é "não começada", mesmo em série encerrada', () => {
    const c = SeriesCompletion.of({ productionStatus: 'Ended', episodesTotal: 62, episodesWatched: 0 });
    assert.equal(c.state, 'not-started');
    assert.equal(c.badge, null, 'não começada não ganha selo');
  });

  it('série sem catálogo (stub do import) não finge estar completa', () => {
    const c = SeriesCompletion.of({ productionStatus: 'Ended', episodesTotal: 0, episodesWatched: 0 });
    assert.equal(c.state, 'not-started');
    assert.equal(c.ratio, 0);
  });

  it('assistido acima do total não estoura a razão — o catálogo pode ter encolhido', () => {
    // Aconteceu de verdade: o realinhamento por ordem de exibição reposiciona episódios.
    const c = SeriesCompletion.of({ productionStatus: 'Ended', episodesTotal: 10, episodesWatched: 14 });
    assert.equal(c.ratio, 1);
    assert.equal(c.remaining, 0);
    assert.equal(c.state, 'finished');
  });

  it('só finalizada e em dia ganham selo; o resto se explica pelo número', () => {
    const finalizada = SeriesCompletion.of({ productionStatus: 'Ended', episodesTotal: 5, episodesWatched: 5 });
    const emDia = SeriesCompletion.of({ productionStatus: 'Returning Series', episodesTotal: 5, episodesWatched: 5 });
    const atrasada = SeriesCompletion.of({ productionStatus: 'Ended', episodesTotal: 5, episodesWatched: 2 });

    assert.equal(finalizada.badge, 'Finalizada');
    assert.equal(emDia.badge, 'Em dia');
    assert.equal(atrasada.badge, null);
  });

  it('tolera espaço em volta do status vindo do TMDB', () => {
    const c = SeriesCompletion.of({ productionStatus: '  Ended  ', episodesTotal: 3, episodesWatched: 3 });
    assert.equal(c.state, 'finished');
  });
});
