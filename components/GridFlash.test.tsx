import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GridFlash from './GridFlash';

const cells = () => screen.getAllByRole('button', { name: /^Cell / });
const litIndexes = () =>
  cells().flatMap((c, i) => (c.getAttribute('data-lit') === 'true' ? [i] : []));
const hide = () => act(() => void vi.advanceTimersByTime(5000));
const play = () => fireEvent.click(screen.getByRole('button', { name: 'Play' }));

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

  it('shows no cells until the player presses Play', () => {
    render(<GridFlash />);
    expect(screen.queryAllByRole('button', { name: /^Cell / })).toHaveLength(0);
    play();
    expect(cells()).toHaveLength(9);
  });

  it('lights up cells, hides them, then lets the player tap', () => {
    render(<GridFlash />);
    play();
    expect(litIndexes()).toHaveLength(2);
    expect(cells().every((c) => (c as HTMLButtonElement).disabled)).toBe(true);
    hide();
    expect(litIndexes()).toHaveLength(0);
    expect(cells().every((c) => !(c as HTMLButtonElement).disabled)).toBe(true);
  });

  it('shows the round number and the number of cells to remember during play', () => {
    render(<GridFlash />);
    play();
    expect(screen.getByText('Round 1')).toBeTruthy();
    expect(screen.getByText('Cells to remember: 2')).toBeTruthy();
    playRoundCorrectly();
    expect(screen.getByText('Round 2')).toBeTruthy();
    expect(screen.getByText('Cells to remember: 3')).toBeTruthy();
  });

  it('keeps a larger pattern visible longer than the first round', () => {
    render(<GridFlash />);
    play();
    playRoundCorrectly();
    act(() => void vi.advanceTimersByTime(1200));
    expect(litIndexes()).toHaveLength(3);
  });

  it('adds one more lit cell after a fully correct round', () => {
    render(<GridFlash />);
    play();
    playRoundCorrectly();
    expect(litIndexes()).toHaveLength(3);
    expect(screen.queryByText('Game over')).toBeNull();
  });

  it('ends the game on the first wrong answer and shows the score of rounds completed', () => {
    render(<GridFlash />);
    play();
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
    play();
    const lit = litIndexes();
    hide();
    fireEvent.click(cells()[lit[0]]);
    expect(screen.queryByText('Game over')).toBeNull();
  });

  it('starts a new game from the game over screen', () => {
    render(<GridFlash />);
    play();
    const lit = litIndexes();
    hide();
    fireEvent.click(cells().find((_, i) => !lit.includes(i))!);
    expect(screen.getByTestId('final-score').textContent).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(screen.queryByText('Game over')).toBeNull();
    expect(litIndexes()).toHaveLength(2);
  });
});
