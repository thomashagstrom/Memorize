/** What the game needs from the server: it issues each round and scores the answers. */
export type RemoteGame = {
  /** Starts a game, or today's daily challenge, and resolves to the first round's pattern. */
  start(daily?: boolean): Promise<number[]>;
  /** Sends the taps made in the current round. Rejects when the server refuses them. */
  answer(taps: number[]): Promise<
    { kind: 'continue'; targets: number[] } | { kind: 'over'; best: number }
  >;
};

/** A game played against the server's API, signed in with the player's ID token. */
export function createRemoteGame(getToken: () => Promise<string>): RemoteGame {
  let gameId = '';
  let round = 0;

  async function post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    async start(daily = false) {
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
