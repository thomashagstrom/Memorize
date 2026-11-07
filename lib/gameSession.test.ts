import { describe, expect, it } from 'vitest';

import { MIN_TAP_MS, MIN_VIEW_MS, newGame, submitAnswer } from './gameSession';

const T0 = 1_000_000;
const slow = (taps: number) => T0 + MIN_VIEW_MS + MIN_TAP_MS * taps + 1;

describe('server-issued rounds', () => {
  it('generates each round on the server and only issues the next one after the current is answered', () => {
    const game = newGame('u1', T0);
    expect(game.level).toBe(1);
    expect(game.targets).toHaveLength(2);

    const outcome = submitAnswer(game, 1, [...game.targets], slow(2));
    expect(outcome.kind).toBe('continue');
    expect(outcome.game.level).toBe(2);
    expect(outcome.game.targets).toHaveLength(3);
  });
});

describe('server-computed score', () => {
  it('scores the rounds the submitted answers completed, whatever the browser might claim', () => {
    let game = newGame('u1', T0);
    let now = T0;
    for (let round = 1; round <= 3; round++) {
      now = slow(game.targets.length) - T0 + now;
      const outcome = submitAnswer(game, round, [...game.targets], now);
      expect(outcome.kind).toBe('continue');
      game = outcome.game;
    }
    const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) => !game.targets.includes(c))!;
    const end = submitAnswer(game, 4, [wrong], now + MIN_VIEW_MS + MIN_TAP_MS + 1);
    expect(end.kind).toBe('over');
    expect(end.game.score).toBe(3);
    expect(end.game.voided).toBe(false);
  });
});

describe('impossible results are rejected', () => {
  it('rejects answers that come back faster than a person could respond, and voids the game', () => {
    const game = newGame('u1', T0);
    const outcome = submitAnswer(game, 1, [...game.targets], T0 + 50);
    expect(outcome.kind).toBe('rejected');
    expect(outcome.game.voided).toBe(true);
    expect(outcome.game.score).toBe(0);
  });

  it('rejects taps made before the pattern could have been seen, even for a wrong answer', () => {
    const game = newGame('u1', T0);
    const wrong = [0, 1, 2, 3].find((c) => !game.targets.includes(c))!;
    expect(submitAnswer(game, 1, [wrong], T0).kind).toBe('rejected');
  });

  it('rejects answers to a round that was never issued', () => {
    const game = newGame('u1', T0);
    const outcome = submitAnswer(game, 5, [...game.targets], slow(2));
    expect(outcome.kind).toBe('rejected');
    expect(outcome.game.score).toBe(0);
    expect(outcome.game.voided).toBe(true);
  });

  it('rejects a game result that is submitted twice, leaving the first result unchanged', () => {
    const game = newGame('u1', T0);
    const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) => !game.targets.includes(c))!;
    const first = submitAnswer(game, 1, [wrong], slow(1));
    expect(first.kind).toBe('over');

    const again = submitAnswer(first.game, 1, [wrong], slow(1));
    expect(again.kind).toBe('rejected');
    expect(again.game).toBe(first.game);
  });

  it('rejects a finished game that is answered again with right taps, so its score cannot grow', () => {
    const game = newGame('u1', T0);
    const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) => !game.targets.includes(c))!;
    const over = submitAnswer(game, 1, [wrong], slow(1)).game;
    const again = submitAnswer(over, 1, [...game.targets], slow(2));
    expect(again.kind).toBe('rejected');
    expect(again.game.score).toBe(0);
  });

  it('rejects taps that are not lit cells in a round that is not finished', () => {
    const game = newGame('u1', T0);
    const [first] = game.targets;
    expect(submitAnswer(game, 1, [first], slow(1)).kind).toBe('rejected');
    expect(submitAnswer(game, 1, [first, first], slow(2)).kind).toBe('over');
    expect(submitAnswer(game, 1, [first, first, first], slow(3)).kind).toBe('rejected');
  });
});
