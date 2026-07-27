import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatRuntime,
  formatTotalTime,
  formatWatchCount,
  formatWatchedAt,
  formatWhen,
} from './format.ts';

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

  it('a versão de frase põe a preposição só onde ela cabe', () => {
    // "visto 18 de jun. de 2026" era a frase faltando uma palavra; "visto em ontem" seria a
    // frase com uma palavra a mais. A preposição depende do ramo, então mora aqui dentro.
    assert.match(formatWhen(dias(-45), AGORA), /^em \d/);
    assert.equal(formatWhen(dias(-1), AGORA), 'ontem');
    assert.equal(formatWhen(dias(7), AGORA), 'em 7 dias');
    assert.equal(formatWhen(null, AGORA), 'nunca');

    // E a versão nua continua nua, para intervalos e colunas.
    assert.doesNotMatch(formatWatchedAt(dias(-45), AGORA), /^em /);
  });

  it('ausência e lixo viram "nunca", não quebram a tela', () => {
    assert.equal(formatWatchedAt(null, AGORA), 'nunca');
    assert.equal(formatWatchedAt(undefined, AGORA), 'nunca');
    assert.equal(formatWatchedAt('isso não é data', AGORA), 'nunca');
  });

  /**
   * O defeito que os testes acima não pegaram, e por quê.
   *
   * Todos eles deslocam múltiplos exatos de 24 h a partir do mesmo instante, então a hora do dia
   * nunca varia — e era justamente a hora do dia que quebrava o rótulo. A conta antiga media
   * milissegundos decorridos e arredondava: um episódio marcado às 8h aparecia como "ontem" às
   * 22h do MESMO dia, porque 14 horas arredondam para um dia.
   *
   * As datas abaixo são montadas em hora local de propósito. A pessoa lê a tela no calendário do
   * aparelho dela, então é esse calendário que o teste tem de reproduzir — fixar um fuso aqui
   * testaria uma coisa que ninguém vê.
   */
  describe('a hora do dia não muda o dia', () => {
    const local = (ano: number, mes: number, dia: number, hora: number, min = 0) =>
      new Date(ano, mes - 1, dia, hora, min);

    it('o que foi marcado de manhã continua sendo "hoje" à noite', () => {
      const noite = local(2026, 7, 25, 22, 0);
      const manha = local(2026, 7, 25, 8, 0);
      assert.equal(formatWatchedAt(manha.toISOString(), noite), 'hoje');
    });

    it('ontem à noite é "ontem" mesmo faltando dez horas para as 24', () => {
      const agora = local(2026, 7, 25, 8, 0);
      const ontemTarde = local(2026, 7, 24, 22, 30);
      assert.equal(formatWatchedAt(ontemTarde.toISOString(), agora), 'ontem');
    });

    it('um minuto depois da meia-noite já é outro dia', () => {
      const agora = local(2026, 7, 25, 0, 1);
      const ontemQuaseMeiaNoite = local(2026, 7, 24, 23, 59);
      assert.equal(formatWatchedAt(ontemQuaseMeiaNoite.toISOString(), agora), 'ontem');
    });

    it('conta dias de calendário, e não períodos de 24 h', () => {
      const agora = local(2026, 7, 25, 23, 59);
      // 3 dias e 23 horas atrás: a conta por duração diria "há 4 dias".
      assert.equal(formatWatchedAt(local(2026, 7, 22, 0, 30).toISOString(), agora), 'há 3 dias');
    });
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
