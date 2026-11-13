import { randomUUID } from 'node:crypto';

import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { nextBest } from '@/lib/bestScore';
import { utcDay } from '@/lib/gridFlash';
import { StepError } from '@/lib/route-errors';
import { newGame, submitAnswer, type Game } from '@/lib/gameSession';

/**
 * The Firebase Admin app, created on first request. Read per request, not at
 * module scope. With no real project configured it talks to the local
 * emulators, like `lib/firebase.ts`.
 */
function admin() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId && process.env.NODE_ENV === 'production') {
    console.error('[gameServer] Missing required configuration: NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    throw new StepError('config', new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID'));
  }
  if (!projectId) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8081';
  }
  let app;
  try {
    app =
      getApps().length > 0
        ? getApp()
        : initializeApp({ projectId: projectId ?? 'demo-app', credential: applicationDefault() });
  } catch (e) {
    throw new StepError('config', e);
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}

export type Player = { uid: string; displayName: string };

/** The player behind a request's `Authorization: Bearer <ID token>` header, or null. */
export async function verifyPlayer(request: Request): Promise<Player | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { auth } = admin(); // a configuration failure throws, so the route can report it
  try {
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, displayName: decoded.name ?? decoded.email ?? 'Player' };
  } catch {
    return null;
  }
}

/**
 * Starts a game and returns its id with the first round's pattern. A daily game
 * uses the UTC day's patterns; a player's first one of the day is their counted
 * attempt (recorded in `dailyScores`), later ones are practice.
 */
export async function startGame(player: Player, daily = false) {
  const { db } = admin();
  const gameId = randomUUID();
  const now = Date.now();
  let game: Game;
  if (daily) {
    const attemptRef = db.collection('dailyScores').doc(`${utcDay(now)}_${player.uid}`);
    try {
      game = await db.runTransaction(async (tx) => {
        const counted = !(await tx.get(attemptRef)).exists;
        // The attempt has no score yet, so it stays off the leaderboard until the game ends.
        if (counted) tx.set(attemptRef, { day: utcDay(now), uid: player.uid, displayName: player.displayName });
        return newGame(player.uid, now, undefined, { counted });
      });
    } catch (e) {
      throw new StepError('daily_attempt', e);
    }
  } else {
    game = newGame(player.uid, now);
  }
  try {
    await db.collection('games').doc(gameId).set(game);
  } catch (e) {
    throw new StepError('save_game', e);
  }
  return { gameId, round: game.level, targets: game.targets, counted: game.counted };
}

export type AnswerResponse =
  | { kind: 'continue'; round: number; targets: number[] }
  | { kind: 'over'; score: number; best: number }
  | { kind: 'rejected' };

/**
 * Scores a round's taps on the server. When the game ends, its score is
 * saved as the player's best if it is higher.
 */
export async function answerRound(
  player: Player,
  gameId: string,
  round: number,
  taps: number[],
): Promise<AnswerResponse> {
  const { db } = admin();
  const gameRef = db.collection('games').doc(gameId);
  const profileRef = db.collection('profiles').doc(player.uid);
  return db.runTransaction<AnswerResponse>(async (tx) => {
    // Firestore wants every read before the first write.
    const [gameSnap, profileSnap] = await Promise.all([tx.get(gameRef), tx.get(profileRef)]);
    const stored = gameSnap.data() as Game | undefined;
    if (!stored || stored.uid !== player.uid) return { kind: 'rejected' };
    const outcome = submitAnswer(stored, round, taps, Date.now());
    if (outcome.kind === 'rejected') {
      if (outcome.game !== stored) tx.set(gameRef, outcome.game);
      return { kind: 'rejected' };
    }
    tx.set(gameRef, outcome.game);
    if (outcome.kind === 'continue') {
      return { kind: 'continue', round: outcome.game.level, targets: outcome.game.targets };
    }
    const best = nextBest(profileSnap.data()?.bestScore as number | undefined, outcome.game.score);
    tx.set(profileRef, { bestScore: best, displayName: player.displayName });
    if (outcome.game.counted && outcome.game.day) {
      tx.set(db.collection('dailyScores').doc(`${outcome.game.day}_${player.uid}`), {
        day: outcome.game.day,
        uid: player.uid,
        displayName: player.displayName,
        score: outcome.game.score,
      });
    }
    return { kind: 'over', score: outcome.game.score, best };
  });
}
