import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HomeShelf } from './homeShelf.ts';
import type { PremiereLike } from './homeShelf.ts';

/**
 * A tela inicial é a única que quase todo mundo vê todo dia, e por isso é a que mais custa quando
 * agrupa errado. Os casos abaixo são os do acervo real: 2 séries vivas contra 47 paradas na data
 * da importação.
 */

const AGORA = new Date('2026-07-25T21:00:00.000Z');
const haDias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();
const item = (lastActivityAt: string | null) => ({ lastActivityAt });

describe('HomeShelf.split', () => {
  it('separa o que está vivo do que está parado', () => {
    const { emAndamento, emPausa } = HomeShelf.split(
      [item(haDias(1)), item(haDias(13)), item(haDias(209)), item(haDias(365))],
      AGORA,
    );

    assert.equal(emAndamento.length, 2);
    assert.equal(emPausa.length, 2);
  });

  it('o corte é em 60 dias, e a borda fica do lado de dentro', () => {
    assert.equal(HomeShelf.split([item(haDias(60))], AGORA).emAndamento.length, 1);
    assert.equal(HomeShelf.split([item(haDias(61))], AGORA).emPausa.length, 1);
  });

  it('sem atividade a série fica em pausa, não em andamento', () => {
    assert.equal(HomeShelf.split([item(null)], AGORA).emPausa.length, 1);
  });

  it('data ilegível não derruba a tela nem inventa atividade', () => {
    assert.equal(HomeShelf.split([item('não é data')], AGORA).emPausa.length, 1);
  });

  it('data no futuro é relógio torto, não abandono', () => {
    assert.equal(HomeShelf.split([item(haDias(-3))], AGORA).emAndamento.length, 1);
  });

  it('preserva a ordem que o servidor mandou dentro de cada prateleira', () => {
    const a = item(haDias(1));
    const b = item(haDias(30));
    const c = item(haDias(200));
    const d = item(haDias(300));
    const { emAndamento, emPausa } = HomeShelf.split([a, c, b, d], AGORA);
    assert.deepEqual(emAndamento, [a, b]);
    assert.deepEqual(emPausa, [c, d]);
  });
});

describe('HomeShelf.greeting', () => {
  it('acompanha a hora local do aparelho', () => {
    const local = (h: number) => new Date(2026, 6, 25, h, 0);
    assert.equal(HomeShelf.greeting(local(2)), 'Boa madrugada');
    assert.equal(HomeShelf.greeting(local(9)), 'Bom dia');
    assert.equal(HomeShelf.greeting(local(15)), 'Boa tarde');
    assert.equal(HomeShelf.greeting(local(21)), 'Boa noite');
  });

  it('vira nas bordas certas — meio-dia é tarde, meia-noite é madrugada', () => {
    const local = (h: number) => new Date(2026, 6, 25, h, 0);
    assert.equal(HomeShelf.greeting(local(11)), 'Bom dia');
    assert.equal(HomeShelf.greeting(local(12)), 'Boa tarde');
    assert.equal(HomeShelf.greeting(local(17)), 'Boa tarde');
    assert.equal(HomeShelf.greeting(local(18)), 'Boa noite');
    assert.equal(HomeShelf.greeting(local(0)), 'Boa madrugada');
  });
});

describe('HomeShelf.summary', () => {
  it('concorda o singular nos dois lados', () => {
    assert.match(HomeShelf.summary(1, 0), /^Uma série em andamento\b/);
    assert.match(HomeShelf.summary(1, 1), /mais uma em pausa/);
    assert.match(HomeShelf.summary(0, 1), /^Uma série em pausa/);
  });

  it('descreve o acervo real sem cobrar nada de ninguém', () => {
    const texto = HomeShelf.summary(2, 47);
    assert.match(texto, /2 séries em andamento/);
    assert.match(texto, /outras 47 em pausa/);
    assert.doesNotMatch(texto, /pendente|atrasad|esperando você|falta/i);
  });

  it('lista vazia é elogio, não erro', () => {
    assert.match(HomeShelf.summary(0, 0), /em dia/);
  });
});

describe('HomeShelf.upcomingPremieres', () => {
  /**
   * Um episódio que estreia daqui a `dias`, com resumo, de uma série que você acompanha mas não
   * está assistindo. Cada teste muda só o que interessa a ele.
   */
  const estreia = (dias: number, extra: Partial<PremiereLike> = {}): PremiereLike => ({
    seriesId: 1,
    seasonNumber: 1,
    episodeNumber: 1,
    airDate: new Date(AGORA.getTime() + dias * 86_400_000).toISOString().slice(0, 10),
    overview: 'Um resumo.',
    lastActivityAt: null,
    ...extra,
  });
  const assistindo = { lastActivityAt: haDias(3) };

  it('um por série: o próximo episódio, e não a temporada inteira', () => {
    // O caso real: Dark Matter semanal enchia a faixa com seis cartões e escondia o resto.
    const e5 = estreia(3, { seriesId: 1, episodeNumber: 5 });
    const e6 = estreia(10, { seriesId: 1, episodeNumber: 6 });
    const e7 = estreia(17, { seriesId: 1, episodeNumber: 7 });
    const outra = estreia(5, { seriesId: 2 });

    assert.deepEqual(HomeShelf.upcomingPremieres([e5, e6, e7, outra], AGORA), [e5, outra]);
  });

  it('o próximo é o mais cedo, não o primeiro que veio na lista', () => {
    const depois = estreia(10, { episodeNumber: 6 });
    const antes = estreia(3, { episodeNumber: 5 });
    assert.deepEqual(HomeShelf.upcomingPremieres([depois, antes], AGORA), [antes]);
  });

  it('estreia dupla no mesmo dia: vale o menor episódio', () => {
    const e2 = estreia(3, { episodeNumber: 2 });
    const e1 = estreia(3, { episodeNumber: 1 });
    assert.deepEqual(HomeShelf.upcomingPremieres([e2, e1], AGORA), [e1]);
  });

  it('do mais próximo ao mais distante, entre séries', () => {
    const longe = estreia(30, { seriesId: 1 });
    const perto = estreia(2, { seriesId: 2 });
    assert.deepEqual(HomeShelf.upcomingPremieres([longe, perto], AGORA), [perto, longe]);
  });

  it('série que você está assistindo aparece a qualquer distância', () => {
    // A volta de Silo: dez meses depois do fim da temporada que você acabou de ver.
    const silo = estreia(290, assistindo);
    assert.deepEqual(HomeShelf.upcomingPremieres([silo], AGORA), [silo]);
  });

  it('série que você só acompanha: só a estreia perto, até 45 dias', () => {
    const perto = estreia(44, { seriesId: 1, lastActivityAt: haDias(200) });
    const longe = estreia(46, { seriesId: 2, lastActivityAt: haDias(200) });
    const nunca = estreia(90, { seriesId: 3, lastActivityAt: null });

    assert.deepEqual(HomeShelf.upcomingPremieres([perto, longe, nunca], AGORA), [perto]);
  });

  it('"assistindo" é o mesmo corte das prateleiras: 60 dias, com a borda do lado de dentro', () => {
    const dentro = estreia(120, { seriesId: 1, lastActivityAt: haDias(60) });
    const fora = estreia(120, { seriesId: 2, lastActivityAt: haDias(61) });
    assert.deepEqual(HomeShelf.upcomingPremieres([dentro, fora], AGORA), [dentro]);
  });

  it('sem resumo não entra — nem perto, nem de série que você está assistindo', () => {
    const semResumo = estreia(3, { ...assistindo, overview: null });
    const emBranco = estreia(3, { seriesId: 2, ...assistindo, overview: '   ' });
    assert.equal(HomeShelf.upcomingPremieres([semResumo, emBranco], AGORA).length, 0);
  });

  it('o próximo sem resumo tira a série da faixa em vez de ceder o lugar ao seguinte', () => {
    const e5 = estreia(3, { episodeNumber: 5, overview: null });
    const e6 = estreia(10, { episodeNumber: 6, overview: 'Já tem resumo.' });
    assert.equal(HomeShelf.upcomingPremieres([e5, e6], AGORA).length, 0);
  });

  it('o que já foi ao ar não é estreia — vira pendência na lista de próximos', () => {
    assert.equal(HomeShelf.upcomingPremieres([estreia(-1)], AGORA).length, 0);
  });

  it('o que estreia hoje continua sendo estreia o dia inteiro', () => {
    assert.equal(HomeShelf.upcomingPremieres([estreia(0)], AGORA).length, 1);
  });

  it('data quebrada é descartada em silêncio, sem derrubar a faixa', () => {
    assert.equal(HomeShelf.upcomingPremieres([estreia(1, { airDate: 'sei lá' })], AGORA).length, 0);
  });
});
