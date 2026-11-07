import { startGame, verifyPlayer } from '@/lib/gameServer';

/** Starts a game for the signed-in player and returns the first round's pattern. */
export async function POST(request: Request) {
  const player = await verifyPlayer(request);
  if (!player) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return Response.json(await startGame(player));
}
