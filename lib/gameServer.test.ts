import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>() }));

vi.mock('firebase-admin/app', () => ({
  applicationDefault: () => ({}),
  getApps: () => [{}],
  getApp: () => ({}),
  initializeApp: () => ({}),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
vi.mock('firebase-admin/firestore', () => {
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        path: `${name}/${id}`,
        set: async (value: Record<string, unknown>) => void h.docs.set(`${name}/${id}`, value),
      }),
    }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
      fn({
        get: async (r: { path: string }) => ({
          exists: h.docs.has(r.path),
          data: () => h.docs.get(r.path),
        }),
        set: (r: { path: string }, value: Record<string, unknown>) => void h.docs.set(r.path, value),
      }),
  };
  return { getFirestore: () => db };
});

import { answerRound, startGame } from './gameServer';
import { MIN_TAP_MS, MIN_VIEW_MS } from './gameSession';

const player = { uid: 'u1', displayName: 'Ann' };
const dailyEntries = () => [...h.docs.keys()].filter((k) => k.startsWith('dailyScores/'));

/** Waits a plausible time, then taps one unlit cell so the game ends. */
async function loseGame(gameId: string, round: number, targets: number[]) {
  vi.setSystemTime(Date.now() + MIN_VIEW_MS + MIN_TAP_MS + 1);
  const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) => !targets.includes(c))!;
  return answerRound(player, gameId, round, [wrong]);
}

describe('daily challenge attempts', () => {
  beforeEach(() => {
    h.docs.clear();
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 7, 12));
  });

  it('counts only the first daily play of a day; a second play is practice and does not enter the daily leaderboard', async () => {
    const first = await startGame(player, true);
    expect(h.docs.get(`games/${first.gameId}`)?.counted).toBe(true);
    expect(dailyEntries()).toHaveLength(1);

    const second = await startGame(player, true);
    expect(h.docs.get(`games/${second.gameId}`)?.counted).toBe(false);
    expect(second.targets).toEqual(first.targets);
    expect(dailyEntries()).toHaveLength(1);

    // A practice game that scores more than the counted one changes nothing.
    vi.setSystemTime(Date.now() + MIN_VIEW_MS + MIN_TAP_MS * 2 + 1);
    const reply = await answerRound(player, second.gameId, 1, [...second.targets]);
    const next = reply.kind === 'continue' ? reply.targets : [];
    await loseGame(second.gameId, 2, next);
    expect(h.docs.get('dailyScores/2026-11-07_u1')?.score).toBe(0);
  });

  it("records the counted attempt's score in that day's daily scores when it ends", async () => {
    const game = await startGame(player, true);
    vi.setSystemTime(Date.now() + MIN_VIEW_MS + MIN_TAP_MS * 2 + 1);
    const reply = await answerRound(player, game.gameId, 1, [...game.targets]);
    const next = reply.kind === 'continue' ? reply.targets : [];
    await loseGame(game.gameId, 2, next);
    expect(h.docs.get('dailyScores/2026-11-07_u1')).toMatchObject({ day: '2026-11-07', score: 1 });
  });

  it('gives the player a new counted attempt on the next UTC day', async () => {
    await startGame(player, true);
    vi.setSystemTime(Date.UTC(2026, 10, 8, 0, 1));
    const next = await startGame(player, true);
    expect(h.docs.get(`games/${next.gameId}`)?.counted).toBe(true);
    expect(dailyEntries()).toHaveLength(2);
  });

  it('keeps a normal game out of the daily scores', async () => {
    await startGame(player);
    expect(dailyEntries()).toHaveLength(0);
  });
});
