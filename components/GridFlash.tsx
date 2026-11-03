'use client';

import { useEffect, useState } from 'react';

import { CELL_COUNT, GRID_SIZE, startRound, tapCell, type Round } from '@/lib/gridFlash';

const FLASH_MS = 1200;

type Phase = 'idle' | 'showing' | 'input' | 'over';

/** Grid Flash: watch the lit cells, then tap them from memory. */
export default function GridFlash({
  flashMs = FLASH_MS,
  onGameOver,
}: {
  flashMs?: number;
  onGameOver?: (score: number) => void;
}) {
  const [level, setLevel] = useState(1);
  // The first round is drawn on Play, not while rendering, so prerender and hydration agree.
  const [round, setRound] = useState<Round>({ targets: [], taps: [] });
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    if (phase !== 'showing') return;
    const timer = setTimeout(() => setPhase('input'), flashMs);
    return () => clearTimeout(timer);
  }, [phase, round, flashMs]);

  function onTap(cell: number) {
    if (phase !== 'input') return;
    const result = tapCell(round, cell);
    if (result.kind === 'wrong') {
      setPhase('over');
      onGameOver?.(level - 1);
    } else if (result.kind === 'complete') {
      setLevel(level + 1);
      setRound(startRound(level + 1));
      setPhase('showing');
    } else {
      setRound(result.round);
    }
  }

  function newGame() {
    setLevel(1);
    setRound(startRound(1));
    setPhase('showing');
  }

  // Score is the number of rounds completed.
  const score = level - 1;

  if (phase === 'idle') {
    return (
      <section className="flex flex-col items-center gap-4" aria-label="Grid Flash">
        <p>Test your memory</p>
        <button
          className="rounded bg-blue-700 px-6 py-3 text-white hover:bg-blue-800"
          onClick={newGame}
        >
          Play
        </button>
      </section>
    );
  }

  if (phase === 'over') {
    return (
      <section className="flex flex-col items-center gap-4" aria-label="Game over">
        <h2 className="text-2xl font-bold">Game over</h2>
        <p>
          Final score: <strong data-testid="final-score">{score}</strong>
        </p>
        <button
          className="rounded bg-blue-700 px-6 py-3 text-white hover:bg-blue-800"
          onClick={newGame}
        >
          Play again
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-4" aria-label="Grid Flash">
      <p>Round {level}</p>
      <p aria-live="polite">{phase === 'showing' ? 'Watch…' : 'Your turn'}</p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: CELL_COUNT }, (_, cell) => {
          const lit =
            (phase === 'showing' && round.targets.includes(cell)) ||
            (phase === 'input' && round.taps.includes(cell));
          return (
            <button
              key={cell}
              aria-label={`Cell ${cell + 1}`}
              data-lit={lit}
              disabled={phase !== 'input'}
              onClick={() => onTap(cell)}
              className={`h-20 w-20 rounded border-2 border-blue-900 ${
                lit ? 'bg-yellow-300' : 'bg-slate-200'
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
