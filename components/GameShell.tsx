'use client';

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';

import Link from 'next/link';

import { loadBest, recordScore } from '@/lib/bestScore';
import { getFirebase } from '@/lib/firebase';

import GridFlash from './GridFlash';

/** Header with Google sign-in and the profile, around a game that saves the best score for signed-in players. */
export default function GameShell() {
  // undefined = still finding out, null = signed out.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [best, setBest] = useState<{ uid: string; value: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(getFirebase().auth, setUser), []);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    let current = true;
    loadBest(uid).then(
      (value) => current && setBest({ uid, value }),
      () => current && setError('Could not load your best score.'),
    );
    return () => {
      current = false;
    };
  }, [uid]);

  async function signIn() {
    setError(null);
    try {
      await signInWithPopup(getFirebase().auth, new GoogleAuthProvider());
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('Sign in failed. Please try again.');
      }
    }
  }

  async function onGameOver(score: number) {
    if (!uid) return; // Guests can play, but nothing is saved.
    try {
      const displayName = user?.displayName ?? user?.email ?? 'Player';
      setBest({ uid, value: await recordScore(uid, score, displayName) });
    } catch {
      setError('Could not save your score.');
    }
  }

  return (
    <>
      <header className="flex items-center justify-end gap-3 p-4">
        <Link href="/leaderboard" className="rounded border px-3 py-1">
          Leaderboard
        </Link>
        {user === undefined ? null : user === null ? (
          <button
            className="rounded border px-3 py-1"
            onClick={() => void signIn()}
          >
            Sign in with Google
          </button>
        ) : (
          <section aria-label="Profile" className="flex items-center gap-3">
            <span>{user.displayName ?? user.email ?? 'Player'}</span>
            <span>
              Best score: <strong data-testid="best-score">{best && best.uid === uid ? best.value : '…'}</strong>
            </span>
            <button
              className="rounded border px-3 py-1"
              onClick={() => void signOut(getFirebase().auth)}
            >
              Sign out
            </button>
          </section>
        )}
      </header>
      {error ? <p role="alert" className="text-center">{error}</p> : null}
      <GridFlash onGameOver={(score) => void onGameOver(score)} />
    </>
  );
}
