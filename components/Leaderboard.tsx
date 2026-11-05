'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { loadLeaderboard, type Leaderboard as LeaderboardData } from '@/lib/bestScore';
import { getFirebase } from '@/lib/firebase';

type Status = 'loading' | 'ready' | 'error';

/** All-time top 50 players by personal best, with the signed-in player's own rank if they are outside it. */
export default function Leaderboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => onAuthStateChanged(getFirebase().auth, setUser), []);

  useEffect(() => {
    if (user === undefined) return;
    let current = true;
    loadLeaderboard(user?.uid ?? null).then(
      (result) => {
        if (!current) return;
        setData(result);
        setStatus('ready');
      },
      () => current && setStatus('error'),
    );
    return () => {
      current = false;
    };
  }, [user]);

  async function retry() {
    setStatus('loading');
    try {
      setData(await loadLeaderboard(user?.uid ?? null));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section aria-label="Leaderboard" className="flex w-full max-w-md flex-col gap-4">
      <h1 className="text-center text-2xl font-bold">All-time highscores</h1>
      {status === 'loading' ? (
        <ul className="flex flex-col gap-2" aria-label="Loading leaderboard">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="h-10 animate-pulse rounded bg-slate-200" />
          ))}
        </ul>
      ) : status === 'error' ? (
        <div role="alert" className="flex flex-col items-center gap-2">
          <p>Couldn&apos;t load the leaderboard</p>
          <button className="rounded border px-3 py-1" onClick={() => void retry()}>
            Retry
          </button>
        </div>
      ) : data && data.top.length === 0 ? (
        <p className="text-center">No scores yet. Be the first!</p>
      ) : (
        data && (
          <>
            <ol className="flex flex-col gap-1">
              {data.top.map((entry) => (
                <li
                  key={entry.uid}
                  className="flex items-center justify-between rounded px-3 py-2 odd:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="w-6 text-right">
                      {entry.rank}
                    </span>
                    <span>{entry.displayName}</span>
                    {user && user.uid === entry.uid ? (
                      <span className="rounded bg-blue-700 px-2 py-0.5 text-xs text-white">You</span>
                    ) : null}
                  </span>
                  <strong>{entry.score}</strong>
                </li>
              ))}
            </ol>
            {data.self ? (
              <div className="flex items-center justify-between rounded border-t px-3 py-2 font-semibold">
                <span>
                  {data.self.rank}. {data.self.displayName}{' '}
                  <span className="rounded bg-blue-700 px-2 py-0.5 text-xs text-white">You</span>
                </span>
                <strong>{data.self.score}</strong>
              </div>
            ) : null}
          </>
        )
      )}
    </section>
  );
}
