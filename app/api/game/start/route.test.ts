import { afterEach, describe, expect, it, vi } from 'vitest';

const player = { uid: 'alice', displayName: 'Alice' };

vi.mock('@/lib/gameServer', () => ({
  verifyPlayer: vi.fn(async () => player),
  startGame: vi.fn(),
}));

import { startGame } from '@/lib/gameServer';
import { POST } from './route';

function request(body?: unknown) {
  return new Request('http://localhost/api/game/start', {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/game/start', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts a daily game for a signed-in player and returns its pattern', async () => {
    const gameId = '11111111-1111-1111-1111-111111111111';
    vi.mocked(startGame).mockResolvedValueOnce({ gameId, round: 1, targets: [1, 2, 3], counted: true });

    const res = await POST(request({ daily: true }));

    expect(res.status).toBe(200);
    expect(startGame).toHaveBeenCalledWith(player, true);
    await expect(res.json()).resolves.toEqual({ gameId, round: 1, targets: [1, 2, 3], counted: true });
  });

  it('starts a free play game for a signed-in player and returns its pattern', async () => {
    const gameId = '22222222-2222-2222-2222-222222222222';
    vi.mocked(startGame).mockResolvedValueOnce({ gameId, round: 1, targets: [4, 5, 6], counted: undefined });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(startGame).toHaveBeenCalledWith(player, false);
    await expect(res.json()).resolves.toMatchObject({ gameId, targets: [4, 5, 6] });
  });

  it('logs the cause and returns a friendly error instead of a bare 500 when starting fails', async () => {
    const error = new Error('database unavailable');
    vi.mocked(startGame).mockRejectedValueOnce(error);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(request({ daily: true }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'could not start game' });
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), error);
  });
});
