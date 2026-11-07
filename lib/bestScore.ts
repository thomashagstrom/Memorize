import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { getFirebase } from '@/lib/firebase';

export const LEADERBOARD_SIZE = 50;

/** The best of the stored score and a new one. A lower or equal score never replaces it. */
export function nextBest(stored: number | undefined, score: number): number {
  return stored === undefined || score > stored ? score : stored;
}

const profileRef = (uid: string) => doc(getFirebase().db, 'profiles', uid);
const profilesCollection = () => collection(getFirebase().db, 'profiles');

/** The player's saved personal best, or 0 if they have none yet. */
export async function loadBest(uid: string): Promise<number> {
  const snap = await getDoc(profileRef(uid));
  return (snap.data()?.bestScore as number | undefined) ?? 0;
}

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  score: number;
  rank: number;
};

export type Leaderboard = {
  /** Up to `LEADERBOARD_SIZE` players, ranked by best score, highest first. */
  top: LeaderboardEntry[];
  /** The signed-in player's own rank and score, present only when they are outside `top`. */
  self: LeaderboardEntry | null;
};

/**
 * Ranks profiles by best score, highest first, each player appearing once.
 * Ties share no special handling beyond stable order: rank is simply the
 * 1-based position in the sorted list. If `selfUid` is outside the top
 * `size`, their own entry is returned separately.
 */
export function buildLeaderboard(
  profiles: { uid: string; displayName: string; score: number }[],
  selfUid: string | null,
  size: number = LEADERBOARD_SIZE,
): Leaderboard {
  const sorted = [...profiles].sort((a, b) => b.score - a.score);
  const ranked: LeaderboardEntry[] = sorted.map((p, i) => ({ ...p, rank: i + 1 }));
  const top = ranked.slice(0, size);
  const selfInTop = selfUid !== null && top.some((e) => e.uid === selfUid);
  const self = selfUid !== null && !selfInTop ? (ranked.find((e) => e.uid === selfUid) ?? null) : null;
  return { top, self };
}

/**
 * Loads the top `LEADERBOARD_SIZE` counted scores of one UTC `day` (like "2026-11-07").
 * Each day has its own scores, so the board starts empty at midnight UTC.
 */
export async function loadDailyLeaderboard(day: string): Promise<Leaderboard> {
  const snap = await getDocs(
    query(
      collection(getFirebase().db, 'dailyScores'),
      where('day', '==', day),
      orderBy('score', 'desc'),
      limit(LEADERBOARD_SIZE),
    ),
  );
  const top: LeaderboardEntry[] = snap.docs.map((d, i) => ({
    uid: d.data().uid as string,
    displayName: (d.data().displayName as string | undefined) ?? 'Player',
    score: (d.data().score as number | undefined) ?? 0,
    rank: i + 1,
  }));
  return { top, self: null };
}

/**
 * Loads the top `LEADERBOARD_SIZE` players by best score, and, when
 * `selfUid` is signed in and outside that list, their own rank and score.
 */
export async function loadLeaderboard(selfUid: string | null): Promise<Leaderboard> {
  const topSnap = await getDocs(
    query(profilesCollection(), orderBy('bestScore', 'desc'), limit(LEADERBOARD_SIZE)),
  );
  const top: LeaderboardEntry[] = topSnap.docs.map((d, i) => ({
    uid: d.id,
    displayName: (d.data().displayName as string | undefined) ?? 'Player',
    score: (d.data().bestScore as number | undefined) ?? 0,
    rank: i + 1,
  }));

  if (!selfUid || top.some((e) => e.uid === selfUid)) return { top, self: null };

  const selfSnap = await getDoc(profileRef(selfUid));
  const selfScore = (selfSnap.data()?.bestScore as number | undefined) ?? 0;
  if (!selfSnap.exists()) return { top, self: null };

  const higherCount = await getCountFromServer(
    query(profilesCollection(), where('bestScore', '>', selfScore)),
  );
  const self: LeaderboardEntry = {
    uid: selfUid,
    displayName: (selfSnap.data()?.displayName as string | undefined) ?? 'Player',
    score: selfScore,
    rank: higherCount.data().count + 1,
  };
  return { top, self };
}
