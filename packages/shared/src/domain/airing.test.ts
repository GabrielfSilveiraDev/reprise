import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Airing } from './airing.ts';

// Meio da tarde, para os testes não dependerem da hora em que rodam.
const AGORA = new Date(2026, 6, 26, 15, 0, 0);

describe('Airing', () => {
  it('ontem já foi ao ar; amanhã não', () => {
    assert.equal(Airing.hasAired('2026-07-25', AGORA), true);
    assert.equal(Airing.hasAired('2026-07-27', AGORA), false);
  });

  it('hoje conta como exibido — o episódio de hoje é o que mais se marca', () => {
    assert.equal(Airing.hasAired('2026-07-26', AGORA), true);
  });

  it('sem data, conta como exibido', () => {
    // 391 episódios do acervo real caem aqui. Bloqueá-los impediria registrar o que se assistiu.
    for (const vazio of [null, undefined, '']) {
      assert.equal(Airing.hasAired(vazio, AGORA), true);
    }
  });

  it('data ilegível não bloqueia', () => {
    assert.equal(Airing.hasAired('sei lá', AGORA), true);
  });

  it('descreve a estreia no tempo verbal certo', () => {
    assert.equal(Airing.label('2026-07-27', AGORA), 'Estreia amanhã');
    assert.equal(Airing.label('2026-07-25', AGORA), 'Estreou ontem');
    assert.equal(Airing.label('2026-08-06', AGORA), 'Estreia em 11 dias');
  });

  it('sem data, não há o que dizer', () => {
    assert.equal(Airing.label(null, AGORA), null);
    assert.equal(Airing.label('sei lá', AGORA), null);
  });
});
