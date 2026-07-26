import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HomeShelf } from './homeShelf.ts';

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
    const { emAndamento, guardadas } = HomeShelf.split(
      [item(haDias(1)), item(haDias(13)), item(haDias(209)), item(haDias(365))],
      AGORA,
    );

    assert.equal(emAndamento.length, 2);
    assert.equal(guardadas.length, 2);
  });

  it('o corte é em 60 dias, e a borda fica do lado de dentro', () => {
    assert.equal(HomeShelf.split([item(haDias(60))], AGORA).emAndamento.length, 1);
    assert.equal(HomeShelf.split([item(haDias(61))], AGORA).guardadas.length, 1);
  });

  it('sem atividade a série está guardada, não em andamento', () => {
    assert.equal(HomeShelf.split([item(null)], AGORA).guardadas.length, 1);
  });

  it('data ilegível não derruba a tela nem inventa atividade', () => {
    assert.equal(HomeShelf.split([item('não é data')], AGORA).guardadas.length, 1);
  });

  it('data no futuro é relógio torto, não abandono', () => {
    assert.equal(HomeShelf.split([item(haDias(-3))], AGORA).emAndamento.length, 1);
  });

  it('preserva a ordem que o servidor mandou dentro de cada prateleira', () => {
    const a = item(haDias(1));
    const b = item(haDias(30));
    const c = item(haDias(200));
    const d = item(haDias(300));
    const { emAndamento, guardadas } = HomeShelf.split([a, c, b, d], AGORA);
    assert.deepEqual(emAndamento, [a, b]);
    assert.deepEqual(guardadas, [c, d]);
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
    assert.match(HomeShelf.summary(1, 1), /mais uma guardada/);
    assert.match(HomeShelf.summary(0, 1), /^Uma série guardada/);
  });

  it('descreve o acervo real sem cobrar nada de ninguém', () => {
    const texto = HomeShelf.summary(2, 47);
    assert.match(texto, /2 séries em andamento/);
    assert.match(texto, /outras 47 guardadas/);
    assert.doesNotMatch(texto, /pendente|atrasad|esperando você|falta/i);
  });

  it('lista vazia é elogio, não erro', () => {
    assert.match(HomeShelf.summary(0, 0), /em dia/);
  });
});

describe('HomeShelf.upcomingPremieres', () => {
  const emDias = (n: number) => {
    const d = new Date(AGORA.getTime() + n * 86_400_000);
    return { airDate: d.toISOString().slice(0, 10) };
  };

  it('corta o que está longe demais para mudar a semana de alguém', () => {
    const lista = [emDias(1), emDias(20), emDias(44), emDias(120)];
    const perto = HomeShelf.upcomingPremieres(lista, AGORA);
    assert.equal(perto.length, 3);
    assert.ok(!perto.includes(lista[3]!), 'estreia a 120 dias não deveria passar');
  });

  it('o que já foi ao ar não é estreia — vira pendência na lista de próximos', () => {
    assert.equal(HomeShelf.upcomingPremieres([emDias(-1)], AGORA).length, 0);
  });

  it('o que estreia hoje continua sendo estreia o dia inteiro', () => {
    assert.equal(HomeShelf.upcomingPremieres([emDias(0)], AGORA).length, 1);
  });

  it('data quebrada é descartada em silêncio, sem derrubar a faixa', () => {
    assert.equal(HomeShelf.upcomingPremieres([{ airDate: 'sei lá' }], AGORA).length, 0);
  });
});
