export const GRID_SIZE = 3;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const FIRST_ROUND_CELLS = 2;

export type Round = {
  /** Cells that were lit this round. */
  targets: number[];
  /** Cells the player has tapped so far. */
  taps: number[];
};

export type TapResult =
  | { kind: 'continue'; round: Round }
  | { kind: 'complete' }
  | { kind: 'wrong' };

/** Picks `count` distinct cells out of the grid. */
export function pickCells(count: number, random: () => number = Math.random): number[] {
  const cells = Array.from({ length: CELL_COUNT }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, Math.min(count, CELL_COUNT));
}

/** Number of cells lit in a round (rounds start at 1); one more each round. */
export function cellsForRound(round: number): number {
  return Math.min(FIRST_ROUND_CELLS + round - 1, CELL_COUNT);
}

export function startRound(round: number, random?: () => number): Round {
  return { targets: pickCells(cellsForRound(round), random), taps: [] };
}

/** Applies a tap: a lit cell not yet tapped is right, anything else ends the game. */
export function tapCell(round: Round, cell: number): TapResult {
  if (!round.targets.includes(cell) || round.taps.includes(cell)) return { kind: 'wrong' };
  const taps = [...round.taps, cell];
  if (taps.length === round.targets.length) return { kind: 'complete' };
  return { kind: 'continue', round: { ...round, taps } };
}
