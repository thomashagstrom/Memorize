import { describeRouteError } from '@/lib/route-errors';

/** A failed request, carrying the plain sentence to show the player. */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

/** What the game needs from the server: it issues each round and scores the answers. */
export type RemoteGame = {
  /** Starts a game and resolves to the first round's pattern. */
  start(): Promise<number[]>;
  /** Sends the taps made in the current round. Rejects when the server refuses them. */
  answer(taps: number[]): Promise<
    { kind: 'continue'; targets: number[] } | { kind: 'over'; best: number }
  >;
};

/** A game played against the server's API, signed in with the player's ID token. */
export function createRemoteGame(getToken: () => Promise<string>, daily = false): RemoteGame {
  let gameId = '';
  let round = 0;

  async function post<T>(path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new RequestError(describeRouteError());
    }
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { step?: string; ref?: string } | null;
      throw new RequestError(describeRouteError(res.status, detail), res.status);
    }
    return (await res.json()) as T;
  }

  return {
    async start() {
      const game = await post<{ gameId: string; round: number; targets: number[] }>(
        '/api/game/start',
        { daily },
      );
      gameId = game.gameId;
      round = game.round;
      return game.targets;
    },
    async answer(taps) {
      const result = await post<
        { kind: 'continue'; round: number; targets: number[] } | { kind: 'over'; best: number }
      >('/api/game/answer', { gameId, round, taps });
      if (result.kind === 'continue') {
        round = result.round;
        return { kind: 'continue', targets: result.targets };
      }
      return { kind: 'over', best: result.best };
    },
  };
}
