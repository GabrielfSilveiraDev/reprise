import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatRuntime, formatTotalTime, formatWatchCount, formatWatchedAt } from './format.ts';

/**
 * Estes testes existem por causa de um defeito real: `Intl.RelativeTimeFormat` não existe no
 * Hermes, e como ele era construído no escopo do módulo, o app Android morria na importação —
 * antes de qualquer tela. O typecheck passava, o bundle compilava, e só o aparelho contou.
 *
 * Por isso a data agora é sempre passada explicitamente: um teste que depende de "agora" real
 * passaria hoje e quebraria na virada do mês.
 */

const AGORA = new Date('2026-07-25T12:00:00.000Z');
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000).toISOString();

describe('formatWatchedAt', () => {
  it('nomeia os dias próximos em vez de contá-los', () => {
    assert.equal(formatWatchedAt(dias(0), AGORA), 'hoje');
    assert.equal(formatWatchedAt(dias(-1), AGORA), 'ontem');
    assert.equal(formatWatchedAt(dias(-2), AGORA), 'anteontem');
    assert.equal(formatWatchedAt(dias(1), AGORA), 'amanhã');
    assert.equal(formatWatchedAt(dias(2), AGORA), 'depois de amanhã');
  });

  it('conta os dias no meio da janela, nos dois sentidos', () => {
    assert.equal(formatWatchedAt(dias(-5), AGORA), 'há 5 dias');
    assert.equal(formatWatchedAt(dias(-29), AGORA), 'há 29 dias');
    assert.equal(formatWatchedAt(dias(7), AGORA), 'em 7 dias');
  });

  it('passa para data absoluta a partir de 30 dias — "há 8 meses" não informa nada', () => {
    const texto = formatWatchedAt(dias(-45), AGORA);
    assert.match(texto, /2026/, `esperava uma data absoluta, veio "${texto}"`);
    assert.doesNotMatch(texto, /há|dias/);
  });

  it('ausência e lixo viram "nunca", não quebram a tela', () => {
    assert.equal(formatWatchedAt(null, AGORA), 'nunca');
    assert.equal(formatWatchedAt(undefined, AGORA), 'nunca');
    assert.equal(formatWatchedAt('isso não é data', AGORA), 'nunca');
  });

  it('não depende de Intl.RelativeTimeFormat — o Hermes não tem', () => {
    const original = Reflect.get(Intl, 'RelativeTimeFormat');
    Reflect.deleteProperty(Intl, 'RelativeTimeFormat');
    try {
      assert.equal(formatWatchedAt(dias(-3), AGORA), 'há 3 dias');
    } finally {
      if (original) Reflect.set(Intl, 'RelativeTimeFormat', original);
    }
  });
});

describe('formatRuntime e formatTotalTime', () => {
  it('minutos abaixo de uma hora, horas e minutos acima', () => {
    assert.equal(formatRuntime(1500), '25 min');
    assert.equal(formatRuntime(5400), '1 h 30 min');
    assert.equal(formatRuntime(7200), '2 h');
  });

  it('ausência de runtime não vira "0 min"', () => {
    assert.equal(formatRuntime(null), '—');
    assert.equal(formatRuntime(0), '—');
  });

  it('tempo acumulado passa a dias na escala de centenas de horas', () => {
    assert.equal(formatTotalTime(3600 * 5), '5 h');
    assert.equal(formatTotalTime(3600 * 50), '2 d 2 h');
  });
});

describe('formatWatchCount', () => {
  it('concorda o plural — "assistido 1 vezes" já escapou uma vez', () => {
    assert.equal(formatWatchCount(0), 'não assistido');
    assert.equal(formatWatchCount(1), 'assistido 1 vez');
    assert.equal(formatWatchCount(17), 'assistido 17 vezes');
  });
});
