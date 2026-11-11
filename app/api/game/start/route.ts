import { startGame, verifyPlayer } from '@/lib/gameServer';

/**
 * Starts a game for the signed-in player and returns the first round's pattern.
 * `{ "daily": true }` starts the daily challenge instead of a normal game.
 */
export async function POST(request: Request) {
  const player = await verifyPlayer(request);
  if (!player) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { daily?: unknown } | null;
  return Response.json(await startGame(player, body?.daily === true));
}
