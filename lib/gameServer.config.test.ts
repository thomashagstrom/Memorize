import { afterEach, describe, expect, it, vi } from 'vitest';

describe('game server configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reports the missing production project ID by name in the logs', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { verifyPlayer } = await import('./gameServer');

    await expect(
      verifyPlayer(new Request('http://test', { headers: { Authorization: 'Bearer t' } })),
    ).rejects.toMatchObject({ step: 'config' });

    expect(spy.mock.calls[0][0]).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    spy.mockRestore();
  });
});
