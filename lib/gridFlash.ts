export const FIRST_GRID_SIZE = 3;
export const FIRST_ROUND_CELLS = 2;

export type Round = {
  /** Cells that were lit this round. */
  targets: number[];
  /** Cells the player has tapped so far. */
  taps: number[];
  /** Colour of each lit cell, parallel to `targets`; empty in a single-colour round. */
  colours?: number[];
  /** Colour the player gave each tapped cell, parallel to `taps`. */
  tapColours?: number[];
};

export type TapResult =
  | { kind: 'continue'; round: Round }
  | { kind: 'complete' }
  | { kind: 'wrong' };

/** The first round whose lit cells come in different colours; earlier rounds are single-colour. */
export const COLOUR_START_LEVEL = 4;

/** The colours a lit cell can have from the colour starting level on; each has a glyph so colour is never the only cue. */
export const COLOURS = [
  { name: 'Red', glyph: '●', className: 'bg-red-600 text-white' },
  { name: 'Blue', glyph: '■', className: 'bg-blue-700 text-white' },
  { name: 'Green', glyph: '▲', className: 'bg-green-700 text-white' },
  { name: 'Yellow', glyph: '◆', className: 'bg-yellow-300 text-black' },
] as const;

/** What a round shows: the lit cells and, parallel to them, each one's colour (an index into COLOURS; empty below the colour starting level). */
export type Pattern = { targets: number[]; colours: number[] };

/** Whether lit cells have colours in a round. */
export const hasColours = (round: number) => round >= COLOUR_START_LEVEL;

/** Picks a colour for each of `count` cells. */
export function pickColours(count: number, random: () => number = Math.random): number[] {
  return Array.from({ length: count }, () => Math.floor(random() * COLOURS.length));
}

/** The pattern of a round: cells first, then colours from the same random function, so a round's cells never depend on colours. */
export function patternForRound(round: number, random?: () => number): Pattern {
  const rand = random ?? Math.random;
  const targets = pickCells(cellsForRound(round), gridSizeForRound(round), rand);
  return { targets, colours: hasColours(round) ? pickColours(targets.length, rand) : [] };
}

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

/** Growth in lit cells per round; the one setting to change to tune how fast patterns grow. */
export const CELL_GROWTH_RATE = 0.25;

/** Number of cells lit in a round (rounds start at 1); about 25% more each round, rounded up, at least one more. */
export function cellsForRound(round: number): number {
  let cells = FIRST_ROUND_CELLS;
  for (let r = 1; r < round; r++) cells = Math.max(cells + 1, Math.ceil(cells * (1 + CELL_GROWTH_RATE)));
  return cells;
}

export const BASE_VIEW_MS = 1200;
export const VIEW_MS_PER_EXTRA_CELL = 250;

/** How long a pattern of `cells` lit cells stays visible: longer for a larger pattern. */
export function viewMsForCells(cells: number): number {
  return BASE_VIEW_MS + VIEW_MS_PER_EXTRA_CELL * Math.max(0, cells - FIRST_ROUND_CELLS);
}

/** Side of the grid in a round: the smallest one where the lit cells cover at most half of it. */
export function gridSizeForRound(round: number): number {
  let size = FIRST_GRID_SIZE;
  while (cellsForRound(round) * 2 > size * size) size++;
  return size;
}

export function startRound(round: number, random?: () => number): Round {
  return { ...patternForRound(round, random), taps: [], tapColours: [] };
}

/** Applies a tap: a lit cell not yet tapped, in the right colour when the round has colours, is right; anything else ends the game. */
export function tapCell(round: Round, cell: number, colour?: number): TapResult {
  const at = round.targets.indexOf(cell);
  if (at < 0 || round.taps.includes(cell)) return { kind: 'wrong' };
  if (round.colours?.length && round.colours[at] !== colour) return { kind: 'wrong' };
  const taps = [...round.taps, cell];
  if (taps.length === round.targets.length) return { kind: 'complete' };
  return { kind: 'continue', round: { ...round, taps, tapColours: [...(round.tapColours ?? []), colour ?? 0] } };
}
