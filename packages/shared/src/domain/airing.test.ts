import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Airing } from './airing.ts';

// Meio da tarde, para os testes não dependerem da hora em que rodam.
const AGORA = new Date(2026, 6, 26, 15, 0, 0);

describe('Airing.hasAired — a regra do botão de marcar', () => {
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
});

/*
 * O caso que originou tudo isto.
 *
 * Silo T3E10 e Dark Matter T2E2 têm air_date 03/09 — quinta, no calendário americano. O episódio
 * só chega ao Brasil na madrugada de sexta, mas a tela dizia "Estreou hoje" desde a meia-noite de
 * quinta. O servidor passa a mandar o instante (fim do dia 03/09 no Pacífico = 04/09 05h em
 * Brasília) e o rótulo passa a falar do calendário de quem lê.
 */
describe('Airing — estreia americana vista do Brasil', () => {
  const QUINTA_TARDE = new Date(2026, 8, 3, 14, 56, 0);
  const SEXTA_5H = new Date(2026, 8, 4, 5, 0, 0);

  it('não diz que estreou enquanto o instante não chegou', () => {
    assert.equal(Airing.hasReleased(SEXTA_5H.toISOString(), '2026-09-03', QUINTA_TARDE), false);
  });

  it('diz "Estreia amanhã", e não "Estreou hoje", para o episódio de hoje que só sai amanhã', () => {
    assert.equal(
      Airing.label('2026-09-03', QUINTA_TARDE, SEXTA_5H.toISOString()),
      'Estreia amanhã'
    );
  });

  it('depois do instante, vira passado', () => {
    const sextaManha = new Date(2026, 8, 4, 9, 0, 0);
    assert.equal(Airing.hasReleased(SEXTA_5H.toISOString(), '2026-09-03', sextaManha), true);
    assert.equal(Airing.label('2026-09-03', sextaManha, SEXTA_5H.toISOString()), 'Estreou hoje');
  });

  it('o botão de marcar continua permissivo no mesmo cenário', () => {
    // As duas perguntas discordam de propósito: a tela é conservadora, o botão não.
    assert.equal(Airing.hasAired('2026-09-03', QUINTA_TARDE), true);
    assert.equal(Airing.hasReleased(SEXTA_5H.toISOString(), '2026-09-03', QUINTA_TARDE), false);
  });
});

describe('Airing — sem o instante do servidor, nada muda', () => {
  it('cai na regra antiga quando releasesAt não vem', () => {
    assert.equal(Airing.hasReleased(null, '2026-07-25', AGORA), true);
    assert.equal(Airing.hasReleased(undefined, '2026-07-27', AGORA), false);
  });

  it('instante ilegível não derruba nem mente', () => {
    assert.equal(Airing.hasReleased('sei lá', '2026-07-25', AGORA), true);
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
