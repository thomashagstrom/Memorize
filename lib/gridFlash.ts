export const FIRST_GRID_SIZE = 3;
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

/** Picks `count` distinct cells out of a `size` × `size` grid. */
export function pickCells(count: number, size: number, random: () => number = Math.random): number[] {
  const cellCount = size * size;
  const cells = Array.from({ length: cellCount }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, Math.min(count, cellCount));
}

/** A deterministic random function in [0, 1) for a text seed (FNV-1a hash feeding mulberry32). */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The UTC day a moment falls on, as `YYYY-MM-DD`: the daily challenge changes at midnight UTC. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Number of cells lit in a round (rounds start at 1); one more each round, with no maximum. */
export function cellsForRound(round: number): number {
  return FIRST_ROUND_CELLS + round - 1;
}

/** Side of the grid in a round: the smallest one where the lit cells cover at most half of it. */
export function gridSizeForRound(round: number): number {
  let size = FIRST_GRID_SIZE;
  while (cellsForRound(round) * 2 > size * size) size++;
  return size;
}

export function startRound(round: number, random?: () => number): Round {
  return { targets: pickCells(cellsForRound(round), gridSizeForRound(round), random), taps: [] };
}

/** Applies a tap: a lit cell not yet tapped is right, anything else ends the game. */
export function tapCell(round: Round, cell: number): TapResult {
  if (!round.targets.includes(cell) || round.taps.includes(cell)) return { kind: 'wrong' };
  const taps = [...round.taps, cell];
  if (taps.length === round.targets.length) return { kind: 'complete' };
  return { kind: 'continue', round: { ...round, taps } };
}
