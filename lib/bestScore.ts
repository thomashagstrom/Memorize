import { doc, getDoc, runTransaction } from 'firebase/firestore';

import { getFirebase } from '@/lib/firebase';

/** The best of the stored score and a new one. A lower or equal score never replaces it. */
export function nextBest(stored: number | undefined, score: number): number {
  return stored === undefined || score > stored ? score : stored;
}

const profileRef = (uid: string) => doc(getFirebase().db, 'profiles', uid);

/** The player's saved personal best, or 0 if they have none yet. */
export async function loadBest(uid: string): Promise<number> {
  const snap = await getDoc(profileRef(uid));
  return (snap.data()?.bestScore as number | undefined) ?? 0;
}

/** Saves `score` as the personal best only if it is higher. Returns the best after saving. */
export async function recordScore(uid: string, score: number): Promise<number> {
  const ref = profileRef(uid);
  return runTransaction(getFirebase().db, async (tx) => {
    const stored = (await tx.get(ref)).data()?.bestScore as number | undefined;
    const best = nextBest(stored, score);
    if (best !== stored) tx.set(ref, { bestScore: best });
    return best;
  });
}
