import { describe, expect, it } from 'vitest';

import { cellsForRound, pickCells, startRound, tapCell } from './gridFlash';

describe('grid flash round logic', () => {
  it('adds one more lit cell each round', () => {
    expect(cellsForRound(2) - cellsForRound(1)).toBe(1);
    expect(startRound(3).targets).toHaveLength(cellsForRound(3));
  });

  it('picks distinct cells', () => {
    expect(new Set(pickCells(5)).size).toBe(5);
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
