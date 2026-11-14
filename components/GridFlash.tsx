'use client';

import { useEffect, useState } from 'react';

import type { RemoteGame } from '@/lib/gameClient';
import {
  COLOURS,
  gridSizeForRound,
  patternForRound,
  startRound,
  tapCell,
  viewMsForCells,
  type Pattern,
  type Round,
} from '@/lib/gridFlash';

type Phase = 'idle' | 'loading' | 'showing' | 'input' | 'over';

/** Grid Flash: watch the lit cells, then tap them from memory. */
export default function GridFlash({
  flashMs,
  onGameOver,
  remote,
}: {
  flashMs?: number;
  onGameOver?: (score: number) => void;
  /** When given, the server issues every round and scores the answers. */
  remote?: RemoteGame;
}) {
  const [level, setLevel] = useState(1);
  // The first round is drawn on Play, not while rendering, so prerender and hydration agree.
  const [round, setRound] = useState<Round>({ targets: [], taps: [] });
  const [phase, setPhase] = useState<Phase>('idle');
  // The colour the next tapped cell gets in a colour round.
  const [colour, setColour] = useState(0);

  useEffect(() => {
    if (phase !== 'showing') return;
    const timer = setTimeout(() => setPhase('input'), flashMs ?? viewMsForCells(round.targets.length));
    return () => clearTimeout(timer);
  }, [phase, round, flashMs]);

  function endGame() {
    setPhase('over');
    onGameOver?.(level - 1);
  }

  function nextRound(pattern: Pattern) {
    setLevel(level + 1);
    setColour(0);
    setRound({ ...pattern, taps: [], tapColours: [] });
    setPhase('showing');
  }

  function onTap(cell: number) {
    if (phase !== 'input') return;
    const result = tapCell(round, cell, colour);
    if (result.kind === 'continue') {
      setRound(result.round);
      return;
    }
    if (!remote) {
      if (result.kind === 'wrong') endGame();
      else nextRound(patternForRound(level + 1));
      return;
    }
    // The server judges the taps and issues the next round, if any.
    setPhase('loading');
    remote.answer([...round.taps, cell], coloured ? [...(round.tapColours ?? []), colour] : undefined).then(
      (reply) => (reply.kind === 'continue' ? nextRound(reply) : endGame()),
      endGame,
    );
  }

  function newGame() {
    setLevel(1);
    if (!remote) {
      setRound(startRound(1));
      setPhase('showing');
      return;
    }
    setPhase('loading');
    remote.start().then(
      (pattern) => {
        setColour(0);
        setRound({ ...pattern, taps: [], tapColours: [] });
        setPhase('showing');
      },
      () => setPhase('idle'),
    );
  }

  const coloured = (round.colours?.length ?? 0) > 0;

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

  const size = gridSizeForRound(level);

  return (
    <section className="flex w-full flex-col items-center gap-4" aria-label="Grid Flash">
      <p>Round {level}</p>
      <p>Cells to remember: {round.targets.length}</p>
      <p aria-live="polite">{phase === 'loading' ? 'Loading…' : phase === 'showing' ? 'Watch…' : 'Your turn'}</p>
      <div
        className="grid w-full gap-1"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          maxWidth: `${size * 5}rem`,
        }}
      >
        {Array.from({ length: size * size }, (_, cell) => {
          const lit =
            (phase === 'showing' && round.targets.includes(cell)) ||
            (phase === 'input' && round.taps.includes(cell));
          const shownColour =
            coloured && lit
              ? phase === 'showing'
                ? round.colours?.[round.targets.indexOf(cell)]
                : round.tapColours?.[round.taps.indexOf(cell)]
              : undefined;
          const shown = shownColour === undefined ? undefined : COLOURS[shownColour];
          return (
            <button
              key={cell}
              aria-label={`Cell ${cell + 1}`}
              data-lit={lit}
              disabled={phase !== 'input'}
              onClick={() => onTap(cell)}
              className={`aspect-square w-full rounded border-2 border-blue-900 ${
                shown ? shown.className : lit ? 'bg-yellow-300' : 'bg-slate-200'
              } text-2xl font-bold`}
            >
              {shown?.glyph}
            </button>
          );
        })}
      </div>
      {coloured && phase === 'input' && (
        <div role="radiogroup" aria-label="Colour" className="flex flex-wrap justify-center gap-2">
          {COLOURS.map((c, i) => (
            <button
              key={c.name}
              role="radio"
              aria-checked={colour === i}
              onClick={() => setColour(i)}
              className={`min-h-12 min-w-12 rounded px-3 ${c.className} ${
                colour === i ? 'ring-4 ring-slate-900 ring-offset-2' : ''
              }`}
            >
              {c.glyph} {c.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
