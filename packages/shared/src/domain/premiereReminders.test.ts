import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PremiereReminders } from './premiereReminders.ts';
import type { ReminderInput } from './premiereReminders.ts';

const AGORA = new Date(2026, 6, 25, 12, 0, 0); // 25/jul/2026, meio-dia local

function estreia(over: Partial<ReminderInput> = {}): ReminderInput {
  return {
    episodeId: 1,
    seriesName: 'Silo',
    seasonNumber: 3,
    episodeNumber: 5,
    episodeName: 'O silo',
    airDate: '2026-07-30',
    isSeasonPremiere: false,
    ...over,
  };
}

describe('PremiereReminders', () => {
  it('agenda às 19h locais, não à meia-noite', () => {
    const [r] = PremiereReminders.plan([estreia()], AGORA);
    assert.equal(r?.fireAt.getHours(), 19);
    assert.equal(r?.fireAt.getDate(), 30);
    assert.equal(r?.fireAt.getMonth(), 6);
  });

  it('não agenda estreia que já passou', () => {
    // A data vem do TMDB e o app pode abrir dias depois, com estreias vencidas ainda na lista.
    const passado = estreia({ airDate: '2026-07-20' });
    assert.deepEqual(PremiereReminders.plan([passado], AGORA), []);
  });

  it('o próprio dia só conta se ainda não passou das 19h', () => {
    const hoje = estreia({ airDate: '2026-07-25' });
    const deManha = new Date(2026, 6, 25, 9, 0, 0);
    const deNoite = new Date(2026, 6, 25, 21, 0, 0);

    assert.equal(PremiereReminders.plan([hoje], deManha).length, 1);
    assert.equal(PremiereReminders.plan([hoje], deNoite).length, 0);
  });

  it('não reagenda o que já está agendado — senão cada abertura do app duplicaria o aviso', () => {
    const p = estreia();
    const [primeiro] = PremiereReminders.plan([p], AGORA);
    const segundaVez = PremiereReminders.plan([p], AGORA, [primeiro!.key]);
    assert.deepEqual(segundaVez, []);
  });

  it('estreia de temporada e episódio comum têm títulos diferentes', () => {
    const [temporada] = PremiereReminders.plan([estreia({ isSeasonPremiere: true })], AGORA);
    const [episodio] = PremiereReminders.plan([estreia({ episodeId: 2 })], AGORA);

    assert.match(temporada!.title, /temporada 3 estreia hoje/);
    assert.match(episodio!.title, /episódio novo hoje/);
  });

  it('o corpo traz o código e o título do episódio', () => {
    const [r] = PremiereReminders.plan([estreia()], AGORA);
    assert.equal(r?.body, 'T3E5 — O silo');
  });

  it('episódio sem título não deixa travessão solto', () => {
    const [r] = PremiereReminders.plan([estreia({ episodeName: null })], AGORA);
    assert.equal(r?.body, 'T3E5');
  });

  it('data malformada é ignorada em vez de derrubar o agendamento inteiro', () => {
    const ruim = estreia({ airDate: 'sei lá', episodeId: 9 });
    const boa = estreia({ episodeId: 10 });
    const planos = PremiereReminders.plan([ruim, boa], AGORA);
    assert.equal(planos.length, 1);
    assert.equal(planos[0]?.episodeId, 10);
  });

  it('a chave é estável por episódio', () => {
    assert.equal(PremiereReminders.keyFor(42), PremiereReminders.keyFor(42));
    assert.notEqual(PremiereReminders.keyFor(42), PremiereReminders.keyFor(43));
  });
});
