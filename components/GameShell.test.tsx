import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (user: unknown) => void;
const h = vi.hoisted(() => ({
  listener: null as null | ((user: unknown) => void),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  loadBest: vi.fn(),
  recordScore: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, cb: Listener) => {
    h.listener = cb;
    return () => {};
  },
  signInWithPopup: h.signInWithPopup,
  signOut: h.signOut,
}));
vi.mock('@/lib/firebase', () => ({ getFirebase: () => ({ auth: {}, db: {} }) }));
vi.mock('@/lib/bestScore', () => ({ loadBest: h.loadBest, recordScore: h.recordScore }));

import GameShell from './GameShell';

const player = { uid: 'u1', displayName: 'Ada Lovelace', email: 'ada@example.com' };
const cells = () => screen.getAllByRole('button', { name: /^Cell / });

/** Plays one game and taps a wrong cell straight away: final score 0. */
function loseGame() {
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  const lit = cells().flatMap((c, i) => (c.getAttribute('data-lit') === 'true' ? [i] : []));
  act(() => void vi.advanceTimersByTime(5000));
  fireEvent.click(cells().find((_, i) => !lit.includes(i))!);
}

describe('Sign in with Google', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.listener = null;
    h.loadBest.mockResolvedValue(5);
    h.recordScore.mockImplementation(async (_uid: string, score: number) => Math.max(5, score));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('lets a signed-out player sign in with Google from the header', () => {
    render(<GameShell />);
    act(() => h.listener!(null));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(h.signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('lets a signed-in player sign out', () => {
    render(<GameShell />);
    act(() => h.listener!(player));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('shows the display name and saved personal best of a signed-in player', async () => {
    render(<GameShell />);
    act(() => h.listener!(player));
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    await vi.waitFor(() => expect(screen.getByTestId('best-score').textContent).toBe('5'));
    expect(h.loadBest).toHaveBeenCalledWith('u1');
  });

  it('saves the score when a signed-in player finishes a game', async () => {
    render(<GameShell />);
    act(() => h.listener!(player));
    loseGame();
    expect(h.recordScore).toHaveBeenCalledWith('u1', 0);
    await vi.waitFor(() => expect(screen.getByTestId('best-score').textContent).toBe('5'));
  });

  it('lets a signed-out player play without saving anything', () => {
    render(<GameShell />);
    act(() => h.listener!(null));
    loseGame();
    expect(screen.getByText('Game over')).toBeTruthy();
    expect(h.recordScore).not.toHaveBeenCalled();
    expect(h.loadBest).not.toHaveBeenCalled();
  });
});
