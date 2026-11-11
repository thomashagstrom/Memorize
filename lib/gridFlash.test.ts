import { describe, expect, it } from 'vitest';

import {
  cellsForRound,
  gridSizeForRound,
  pickCells,
  startRound,
  tapCell,
  viewMsForCells,
} from './gridFlash';

describe('grid flash round logic', () => {
  it('grows lit cells by about 25% per round, rounded up and by at least one, each step no smaller than the last', () => {
    let previousStep = 0;
    for (let round = 2; round <= 30; round++) {
      const before = cellsForRound(round - 1);
      const step = cellsForRound(round) - before;
      expect(step).toBe(Math.max(1, Math.ceil(before * 0.25)));
      expect(step).toBeGreaterThanOrEqual(previousStep);
      previousStep = step;
    }
  });

  it('shows a larger pattern for longer than a smaller one', () => {
    expect(viewMsForCells(10)).toBeGreaterThan(viewMsForCells(5));
    expect(viewMsForCells(5)).toBeGreaterThan(viewMsForCells(2));
  });

  it('lights as many cells as the round calls for', () => {
    expect(startRound(3).targets).toHaveLength(cellsForRound(3));
  });

  it('picks distinct cells', () => {
    expect(new Set(pickCells(5, 3)).size).toBe(5);
  });

  it('grows the grid so lit cells never cover more than half of it, at any level', () => {
    let previousSize = 0;
    for (let round = 1; round <= 60; round++) {
      const size = gridSizeForRound(round);
      expect(cellsForRound(round) * 2).toBeLessThanOrEqual(size * size);
      expect(cellsForRound(round)).toBeLessThan(size * size);
      expect(size).toBeGreaterThanOrEqual(previousSize);
      previousSize = size;
    }
    expect(gridSizeForRound(1)).toBe(3);
    expect(gridSizeForRound(8)).toBeGreaterThan(gridSizeForRound(1));
  });

  it('has no maximum level: round 11 and beyond still light a valid pattern', () => {
    for (const round of [11, 25, 40]) {
      const { targets } = startRound(round);
      const cellCount = gridSizeForRound(round) ** 2;
      expect(targets).toHaveLength(cellsForRound(round));
      expect(new Set(targets).size).toBe(targets.length);
      expect(targets.every((c) => c >= 0 && c < cellCount)).toBe(true);
    }
  });

  it('never repeats the previous round pattern or lights every cell', () => {
    for (let round = 2; round <= 60; round++) {
      const prev = startRound(round - 1).targets;
      const next = startRound(round).targets;
      expect(next.length).not.toBe(prev.length);
      expect(next.length).toBeLessThan(gridSizeForRound(round) ** 2);
    }
  });

  it('completes the round once every lit cell is tapped, in any order', () => {
    const round = startRound(1);
    const [a, b] = round.targets;
    const first = tapCell(round, b);
    expect(first.kind).toBe('continue');
    if (first.kind === 'continue') expect(tapCell(first.round, a).kind).toBe('complete');
  });

  it('ends on a cell that was not lit, and on a repeated tap', () => {
    const round = startRound(1);
    const unlit = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) => !round.targets.includes(c))!;
    expect(tapCell(round, unlit).kind).toBe('wrong');
    const first = tapCell(round, round.targets[0]);
    if (first.kind === 'continue') expect(tapCell(first.round, round.targets[0]).kind).toBe('wrong');
  });
});
