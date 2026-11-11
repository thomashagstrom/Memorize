import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for Firestore: documents by "collection/id".
const store = new Map<string, Record<string, unknown>>();
const ref = (path: string) => ({ path });
const fakeDb = {
  collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
  runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
    fn({
      get: async (r: { path: string }) => ({ exists: store.has(r.path), data: () => store.get(r.path) }),
      set: (r: { path: string }, data: Record<string, unknown>) => void store.set(r.path, data),
    }),
};
vi.mock('firebase-admin/app', () => ({
  applicationDefault: () => ({}),
  getApp: () => ({}),
  getApps: () => [{}],
  initializeApp: () => ({}),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        path: `${name}/${id}`,
        set: async (data: Record<string, unknown>) => void store.set(`${name}/${id}`, data),
      }),
    }),
    runTransaction: fakeDb.runTransaction,
  }),
}));

import { answerRound, startGame } from './gameServer';
import { MIN_TAP_MS, MIN_VIEW_MS } from './gameSession';

const alice = { uid: 'alice', displayName: 'Alice' };
const dailyScores = () => [...store.entries()].filter(([k]) => k.startsWith('dailyScores/'));

/** Plays a game with one wrong tap straight away, after waiting long enough to be believable. */
async function finishWithScoreZero(player: typeof alice, gameId: string, targets: number[]) {
  vi.setSystemTime(Date.now() + MIN_VIEW_MS + MIN_TAP_MS + 1);
  const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) => !targets.includes(c))!;
  return answerRound(player, gameId, 1, [wrong]);
}

describe('daily challenge attempts', () => {
  beforeEach(() => {
    store.clear();
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 0, 5, 10));
  });

  it('counts only a player’s first daily play of the day; further plays are practice', async () => {
    const first = await startGame(alice, true);
    const second = await startGame(alice, true);
    expect(first.counted).toBe(true);
    expect(second.counted).toBe(false);
    expect(second.targets).toEqual(first.targets);
  });

  it('keeps a practice play off the daily leaderboard and leaves the counted score unchanged', async () => {
    const counted = await startGame(alice, true);
    await finishWithScoreZero(alice, counted.gameId, counted.targets);
    const before = dailyScores();
    expect(before).toHaveLength(1);
    expect(before[0][1].score).toBe(0);

    const practice = await startGame(alice, true);
    await finishWithScoreZero(alice, practice.gameId, practice.targets);
    expect(dailyScores()).toEqual(before);
  });

  it('lets a player have a new counted attempt once the UTC day changes', async () => {
    await startGame(alice, true);
    vi.setSystemTime(Date.UTC(2026, 0, 6, 0, 0, 1));
    expect((await startGame(alice, true)).counted).toBe(true);
  });

  it('does not enter a normal game on the daily leaderboard', async () => {
    const game = await startGame(alice);
    await finishWithScoreZero(alice, game.gameId, game.targets);
    expect(dailyScores()).toHaveLength(0);
  });
});
