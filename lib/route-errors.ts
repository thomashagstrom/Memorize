import { randomUUID } from 'node:crypto';

/** An error that knows which step of a route failed. */
export class StepError extends Error {
  code?: string;
  constructor(
    readonly step: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.code = (cause as { code?: string } | null)?.code;
  }
}

/**
 * Logs a route's real error server-side (never the request body or a secret) with a
 * reference ID and the failing step, and returns a safe response for the browser:
 * a short code and the reference ID, never the raw message or a stack.
 */
export function routeError(where: string, error: unknown) {
  const detail =
    error instanceof Error ? ((error as { code?: string }).code ?? error.message) : String(error);
  const step = error instanceof StepError ? error.step : 'unknown';
  const ref = randomUUID().slice(0, 8);
  console.error(`[${where}] ref=${ref} step=${step}`, detail);
  return Response.json({ error: 'server_error', step, ref }, { status: 500 });
}

const STEP_SENTENCES: Record<string, string> = {
  config: 'The game server is not set up correctly. The site owner needs to fix its configuration.',
  daily_attempt: 'We could not record your daily challenge attempt. Please try again.',
  save_game: 'The game server could not save your new game. Please try again.',
};

/**
 * The plain sentence to show a player for a route's error response, with its reference ID.
 * No status means the server could not be reached at all.
 */
export function describeRouteError(
  status?: number,
  body?: { step?: string; ref?: string } | null,
): string {
  let sentence = 'Something went wrong on our end. Please try again.';
  if (status === 401) sentence = 'Your session has expired, please sign in again.';
  else if (status === undefined)
    sentence = 'The game server could not be reached. Check your connection and try again.';
  else if (body?.step && STEP_SENTENCES[body.step]) sentence = STEP_SENTENCES[body.step];
  return body?.ref ? `${sentence} (Reference: ${body.ref})` : sentence;
}
