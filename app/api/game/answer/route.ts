import { answerRound, verifyPlayer } from '@/lib/gameServer';

/** Scores the taps a signed-in player made in one round. The browser never sends a score. */
export async function POST(request: Request) {
  const player = await verifyPlayer(request);
  if (!player) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    gameId?: unknown;
    round?: unknown;
    taps?: unknown;
  } | null;
  if (
    typeof body?.gameId !== 'string' ||
    typeof body.round !== 'number' ||
    !Array.isArray(body.taps) ||
    body.taps.length > 100
  ) {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }

  try {
    const result = await answerRound(player, body.gameId, body.round, body.taps as number[]);
    // A rejected result says nothing about why.
    if (result.kind === 'rejected') return Response.json({ error: 'rejected' }, { status: 422 });
    return Response.json(result);
  } catch (e) {
    console.error('Failed to score round', e);
    return Response.json({ error: 'could not save score' }, { status: 500 });
  }
}
