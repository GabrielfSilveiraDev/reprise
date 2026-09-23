import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SeasonDisclosure } from './seasonDisclosure.ts';
import type { DisclosableSeason } from './seasonDisclosure.ts';

function temporada(
  seasonNumber: number,
  vistos: number[],
  isSpecials = false,
): DisclosableSeason {
  return { seasonNumber, isSpecials, episodes: vistos.map((watchCount) => ({ watchCount })) };
}

describe('SeasonDisclosure.defaultOpen', () => {
  it('abre a primeira temporada regular com episódio por assistir', () => {
    const seasons = [temporada(1, [1, 1]), temporada(2, [1, 0]), temporada(3, [0, 0])];
    assert.equal(SeasonDisclosure.defaultOpen(seasons), 2);
  });

  it('especial não disputa o posto — ninguém retoma uma série por um especial', () => {
    const seasons = [temporada(0, [0, 0], true), temporada(1, [1, 1]), temporada(2, [0])];
    assert.equal(SeasonDisclosure.defaultOpen(seasons), 2);
  });

  it('série em dia abre a primeira regular', () => {
    const seasons = [temporada(0, [1], true), temporada(1, [1, 1]), temporada(2, [1])];
    assert.equal(SeasonDisclosure.defaultOpen(seasons), 1);
  });

  it('só especiais: abre o que houver, em vez de deixar tudo fechado', () => {
    assert.equal(SeasonDisclosure.defaultOpen([temporada(0, [1], true)]), 0);
  });

  it('sem temporada nenhuma, não há o que abrir', () => {
    assert.equal(SeasonDisclosure.defaultOpen([]), null);
  });
});

describe('SeasonDisclosure.isOpen', () => {
  const seasons = [temporada(1, [1, 1]), temporada(2, [0, 0])];

  it('sem preferência, vale o padrão', () => {
    assert.equal(SeasonDisclosure.isOpen(2, null, seasons), true);
    assert.equal(SeasonDisclosure.isOpen(1, null, seasons), false);
  });

  it('o guardado vence o padrão nas DUAS direções', () => {
    // Fechar a que abriria sozinha é justamente o caso que a memória existe para respeitar.
    assert.equal(SeasonDisclosure.isOpen(2, { '2': false }, seasons), false);
    assert.equal(SeasonDisclosure.isOpen(1, { '1': true }, seasons), true);
  });

  it('preferência de uma temporada não vaza para as outras', () => {
    assert.equal(SeasonDisclosure.isOpen(1, { '2': false }, seasons), false);
    assert.equal(SeasonDisclosure.isOpen(2, { '1': true }, seasons), true);
  });
});

describe('SeasonDisclosure.toggle', () => {
  it('acrescenta sem alterar o que recebeu', () => {
    const antes = { '1': true };
    const depois = SeasonDisclosure.toggle(antes, 2, false);

    assert.deepEqual(depois, { '1': true, '2': false });
    assert.deepEqual(antes, { '1': true });
  });

  it('parte do vazio quando não havia nada guardado', () => {
    assert.deepEqual(SeasonDisclosure.toggle(null, 3, true), { '3': true });
  });
});

describe('SeasonDisclosure.parse', () => {
  it('lê o que é utilizável', () => {
    assert.deepEqual(SeasonDisclosure.parse('{"1":true,"2":false}'), { '1': true, '2': false });
  });

  it('descarta valor que não é booleano, em vez de confiar', () => {
    assert.deepEqual(SeasonDisclosure.parse('{"1":true,"2":"sim","3":7}'), { '1': true });
  });

  it('armazenamento vazio, corrompido ou de outro formato não derruba a tela', () => {
    for (const ruim of [null, undefined, '', 'nada disso', '[]', '"texto"', '42']) {
      assert.deepEqual(SeasonDisclosure.parse(ruim), {});
    }
  });
});
