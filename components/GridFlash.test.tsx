import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GridFlash from './GridFlash';

const cells = () => screen.getAllByRole('button', { name: /^Cell / });
const litIndexes = () =>
  cells().flatMap((c, i) => (c.getAttribute('data-lit') === 'true' ? [i] : []));
const hide = () => act(() => void vi.advanceTimersByTime(5000));

/** Reads the lit cells, hides them, taps them all. */
function playRoundCorrectly() {
  const lit = litIndexes();
  hide();
  lit.forEach((i) => fireEvent.click(cells()[i]));
  return lit;
}

describe('Grid Flash', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('lights up cells, hides them, then lets the player tap', () => {
    render(<GridFlash />);
    expect(litIndexes()).toHaveLength(2);
    expect(cells().every((c) => (c as HTMLButtonElement).disabled)).toBe(true);
    hide();
    expect(litIndexes()).toHaveLength(0);
    expect(cells().every((c) => !(c as HTMLButtonElement).disabled)).toBe(true);
  });

  it('adds one more lit cell after a fully correct round', () => {
    render(<GridFlash />);
    playRoundCorrectly();
    expect(litIndexes()).toHaveLength(3);
    expect(screen.queryByText('Game over')).toBeNull();
  });

  it('ends the game on the first wrong answer and shows the score of rounds completed', () => {
    render(<GridFlash />);
    playRoundCorrectly();
    const lit = litIndexes();
    hide();
    const wrong = cells().findIndex((_, i) => !lit.includes(i));
    fireEvent.click(cells()[wrong]);
    expect(screen.getByText('Game over')).toBeTruthy();
    expect(screen.getByTestId('final-score').textContent).toBe('1');
  });

  it('does not end the game on a correct tap', () => {
    render(<GridFlash />);
    const lit = litIndexes();
    hide();
    fireEvent.click(cells()[lit[0]]);
    expect(screen.queryByText('Game over')).toBeNull();
  });

  it('starts a new game from the game over screen', () => {
    render(<GridFlash />);
    const lit = litIndexes();
    hide();
    fireEvent.click(cells().find((_, i) => !lit.includes(i))!);
    expect(screen.getByTestId('final-score').textContent).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(screen.queryByText('Game over')).toBeNull();
    expect(litIndexes()).toHaveLength(2);
  });
});
