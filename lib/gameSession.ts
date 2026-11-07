import { cellsForRound, gridSizeForRound, pickCells } from '@/lib/gridFlash';

/** Time the player is shown the pattern before they can answer. */
export const MIN_VIEW_MS = 1200;
/** Fastest a person can plausibly tap one cell. */
export const MIN_TAP_MS = 100;

/** A game as the server keeps it. The player only ever sees the current round's targets. */
export type Game = {
  uid: string;
  /** The round in play, starting at 1. */
  level: number;
  targets: number[];
  /** When the server issued the current round, in epoch milliseconds. */
  issuedAt: number;
  /** Rounds completed so far; this is the score. */
  score: number;
  over: boolean;
  /** Set when an impossible answer was rejected: the game never reaches the leaderboard. */
  voided: boolean;
};

export type Outcome =
  | { kind: 'continue'; game: Game }
  | { kind: 'over'; game: Game }
  | { kind: 'rejected'; game: Game };

export function newGame(uid: string, now: number, random?: () => number): Game {
  return {
    uid,
    level: 1,
    targets: pickCells(cellsForRound(1), gridSizeForRound(1), random),
    issuedAt: now,
    score: 0,
    over: false,
    voided: false,
  };
}

const reject = (game: Game): Outcome => ({ kind: 'rejected', game: { ...game, over: true, voided: true } });

/**
 * Judges the taps a player made in `round`. The server alone decides the score:
 * a finished game, a round that was never issued, taps that came back faster than
 * a person could make them, or taps that do not add up are all rejected.
 */
export function submitAnswer(
  game: Game,
  round: number,
  taps: number[],
  now: number,
  random?: () => number,
): Outcome {
  // A game that already ended is left exactly as it was, so a repeat changes nothing.
  if (game.over) return { kind: 'rejected', game };
  if (round !== game.level) return reject(game);
  if (taps.length === 0 || !taps.every((t) => Number.isInteger(t))) return reject(game);
  if (now - game.issuedAt < MIN_VIEW_MS + MIN_TAP_MS * taps.length) return reject(game);

  const seen: number[] = [];
  for (const [i, cell] of taps.entries()) {
    if (!game.targets.includes(cell) || seen.includes(cell)) {
      // A wrong tap is the player's last one.
      if (i !== taps.length - 1) return reject(game);
      return { kind: 'over', game: { ...game, over: true } };
    }
    seen.push(cell);
  }
  // Right so far but not every lit cell was tapped: no round ended this way.
  if (seen.length !== game.targets.length) return reject(game);

  const level = game.level + 1;
  const next: Game = {
    ...game,
    level,
    score: game.score + 1,
    targets: pickCells(cellsForRound(level), gridSizeForRound(level), random),
    issuedAt: now,
  };
  return { kind: 'continue', game: next };
}
