import { describe, expect, it, vi } from 'vitest';

const verifyPlayer = vi.fn();
const startGame = vi.fn();
vi.mock('@/lib/gameServer', () => ({ verifyPlayer, startGame }));

const player = { uid: 'alice', displayName: 'Alice' };
const request = () =>
  new Request('http://test/api/game/start', {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
    body: JSON.stringify({ daily: true }),
  });

describe('POST /api/game/start', () => {
  it('starts the game and returns its pattern when startGame succeeds', async () => {
    verifyPlayer.mockResolvedValue(player);
    startGame.mockResolvedValue({ gameId: 'g1', round: 1, targets: [1, 2, 3], counted: true });
    const { POST } = await import('./route');

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ gameId: 'g1', round: 1, targets: [1, 2, 3], counted: true });
  });

  it('logs the cause and answers with a short code, never a 500 with the raw error, when startGame throws', async () => {
    verifyPlayer.mockResolvedValue(player);
    startGame.mockRejectedValue(new Error('credential failure: missing GOOGLE_APPLICATION_CREDENTIALS'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('./route');

    const res = await POST(request());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('server_error');
    expect(JSON.stringify(body)).not.toContain('GOOGLE_APPLICATION_CREDENTIALS');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('starts a free play game for a player with no profile or best score yet', async () => {
    verifyPlayer.mockResolvedValue(player);
    startGame.mockResolvedValue({ gameId: 'g2', round: 1, targets: [0, 4, 8], counted: undefined });
    const { POST } = await import('./route');

    const freeplayRequest = new Request('http://test/api/game/start', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: JSON.stringify({ daily: false }),
    });
    const res = await POST(freeplayRequest);

    expect(res.status).toBe(200);
    expect(startGame).toHaveBeenCalledWith(player, false);
  });
});
