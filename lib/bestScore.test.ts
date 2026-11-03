import { describe, expect, it } from 'vitest';

import { buildLeaderboard, nextBest } from './bestScore';

describe('nextBest', () => {
  it('keeps the stored best when the new score is lower', () => {
    expect(nextBest(5, 3)).toBe(5);
  });

  it('keeps the stored best when the new score is equal', () => {
    expect(nextBest(5, 5)).toBe(5);
  });

  it('raises the best when the new score is higher', () => {
    expect(nextBest(5, 6)).toBe(6);
  });

  it('uses the first score when nothing is stored', () => {
    expect(nextBest(undefined, 0)).toBe(0);
  });
});

describe('buildLeaderboard', () => {
  function profile(uid: string, score: number) {
    return { uid, displayName: `Player ${uid}`, score };
  }

  it('shows the top 50 players by personal best, with rank, display name and score', () => {
    const profiles = Array.from({ length: 60 }, (_, i) => profile(`p${i}`, 60 - i));
    const { top } = buildLeaderboard(profiles, null);
    expect(top).toHaveLength(50);
    expect(top[0]).toEqual({ uid: 'p0', displayName: 'Player p0', score: 60, rank: 1 });
    expect(top[49]).toEqual({ uid: 'p49', displayName: 'Player p49', score: 11, rank: 50 });
  });

  it('keeps each player at most once, with their best score, even with ties', () => {
    const profiles = [profile('a', 10), profile('b', 10), profile('c', 5)];
    const { top } = buildLeaderboard(profiles, null);
    const uids = top.map((e) => e.uid);
    expect(uids).toEqual(['a', 'b', 'c']);
    expect(new Set(uids).size).toBe(uids.length);
    expect(top.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("gives a signed-in player outside the top 50 their own rank and score", () => {
    const profiles = Array.from({ length: 55 }, (_, i) => profile(`p${i}`, 55 - i));
    const { top, self } = buildLeaderboard(profiles, 'p52');
    expect(top.some((e) => e.uid === 'p52')).toBe(false);
    expect(self).toEqual({ uid: 'p52', displayName: 'Player p52', score: 3, rank: 53 });
  });

  it('does not show a separate own-rank row when the signed-in player is already in the top 50', () => {
    const profiles = Array.from({ length: 10 }, (_, i) => profile(`p${i}`, 10 - i));
    const { self } = buildLeaderboard(profiles, 'p0');
    expect(self).toBeNull();
  });
});
