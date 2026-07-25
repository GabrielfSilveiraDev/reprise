import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SessionSummary } from './sessionSummary.ts';
import type { SessionLike } from './sessionSummary.ts';

function sessao(over: Partial<SessionLike> = {}): SessionLike {
  return {
    ordinal: 1,
    startedAt: '2024-03-01T20:00:00Z',
    endedAt: '2024-03-12T22:00:00Z',
    exhibitions: 24,
    distinctEpisodes: 24,
    spanDays: 12,
    ...over,
  };
}

describe('SessionSummary', () => {
  it('numera a passada no feminino, concordando com "vez"', () => {
    assert.equal(SessionSummary.ordinalLabel(1), '1ª vez');
    assert.equal(SessionSummary.ordinalLabel(3), '3ª vez');
  });

  it('omite as exibições quando são iguais aos episódios — seria o mesmo número duas vezes', () => {
    assert.equal(SessionSummary.detail(sessao()), '12 dias · 24 episódios');
  });

  it('mostra as exibições quando passam dos episódios: aí a diferença é a notícia', () => {
    const s = sessao({ exhibitions: 30, distinctEpisodes: 24 });
    assert.equal(SessionSummary.detail(s), '12 dias · 24 episódios · 30 exibições');
  });

  it('uma passada de um dia não vira "1 dias"', () => {
    assert.equal(SessionSummary.detail(sessao({ spanDays: 1 })), 'em um dia · 24 episódios');
  });

  it('concorda o singular de episódio', () => {
    const s = sessao({ spanDays: 1, exhibitions: 1, distinctEpisodes: 1 });
    assert.equal(SessionSummary.detail(s), 'em um dia · 1 episódio');
  });

  it('sem backfill, não há aviso a dar', () => {
    assert.equal(SessionSummary.hiddenNotice(0), null);
    assert.equal(SessionSummary.hiddenNotice(-3), null);
  });

  it('com backfill, o aviso diz quantas e por quê', () => {
    const aviso = SessionSummary.hiddenNotice(2851);
    assert.match(aviso!, /2\.851/);
    assert.match(aviso!, /data da importação/);
  });
});
