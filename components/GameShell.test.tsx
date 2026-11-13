import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (user: unknown) => void;
const h = vi.hoisted(() => ({
  listener: null as null | ((user: unknown) => void),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  loadBest: vi.fn(),
  start: vi.fn(),
  answer: vi.fn(),
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
vi.mock('@/lib/bestScore', () => ({ loadBest: h.loadBest }));
vi.mock('@/lib/gameClient', () => ({
  createRemoteGame: () => ({ start: h.start, answer: h.answer }),
}));

import GameShell from './GameShell';

const player = {
  uid: 'u1',
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
  getIdToken: async () => 'test-token',
};
const cells = () => screen.getAllByRole('button', { name: /^Cell / });

/** Plays one game and taps a wrong cell straight away: final score 0. */
async function loseGame() {
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await act(async () => {}); // let a server-issued first round arrive
  const lit = cells().flatMap((c, i) => (c.getAttribute('data-lit') === 'true' ? [i] : []));
  act(() => void vi.advanceTimersByTime(5000));
  fireEvent.click(cells().find((_, i) => !lit.includes(i))!);
}

describe('Sign in with Google', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.listener = null;
    h.loadBest.mockResolvedValue(5);
    h.start.mockResolvedValue([0, 1]);
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

  it('has the server issue the rounds and score the answers for a signed-in player', async () => {
    h.answer.mockResolvedValue({ kind: 'over', best: 7 });
    render(<GameShell />);
    act(() => h.listener!(player));
    await loseGame();
    await vi.waitFor(() => expect(screen.getByTestId('best-score').textContent).toBe('7'));
    expect(h.start).toHaveBeenCalledTimes(1);
    // Only the taps go to the server, never a score.
    expect(h.answer).toHaveBeenCalledTimes(1);
    expect(h.answer.mock.calls[0]).toHaveLength(1);
    expect(h.answer.mock.calls[0][0]).toHaveLength(1);
  });

  it('shows an error and keeps the old best when the server rejects the result', async () => {
    h.answer.mockRejectedValue(new Error('Request failed: 422'));
    render(<GameShell />);
    act(() => h.listener!(player));
    await vi.waitFor(() => expect(screen.getByTestId('best-score').textContent).toBe('5'));
    await loseGame();
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not save your score.'));
    expect(screen.getByTestId('best-score').textContent).toBe('5');
  });

  it('shows an error when the game fails to start, instead of silently returning to Play', async () => {
    h.start.mockRejectedValue(new Error('network error'));
    render(<GameShell />);
    act(() => h.listener!(player));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await vi.waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Could not start the game. Please try again.'),
    );
    expect(screen.queryAllByRole('button', { name: /^Cell / })).toHaveLength(0);
  });

  it('shows the specific reason and reference ID when the start request fails', async () => {
    const failure = new Error('Your session has expired, please sign in again. (Reference: ab12cd34)');
    failure.name = 'RequestError';
    h.start.mockRejectedValue(failure);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<GameShell />);
    act(() => h.listener!(player));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await vi.waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Your session has expired, please sign in again. (Reference: ab12cd34)',
      ),
    );
    spy.mockRestore();
  });

  it('lets a signed-out player play without saving anything', async () => {
    render(<GameShell />);
    act(() => h.listener!(null));
    await loseGame();
    expect(screen.getByText('Game over')).toBeTruthy();
    expect(h.start).not.toHaveBeenCalled();
    expect(h.answer).not.toHaveBeenCalled();
    expect(h.loadBest).not.toHaveBeenCalled();
  });
});
