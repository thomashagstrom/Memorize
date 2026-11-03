import { describe, expect, it } from 'vitest';

import { nextBest } from './bestScore';

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
