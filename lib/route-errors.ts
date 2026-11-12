/**
 * Logs a route's real error server-side (never the request body or a secret) and
 * returns a safe response for the browser: a short code, never the raw message or a stack.
 */
export function routeError(where: string, error: unknown) {
  const detail =
    error instanceof Error ? ((error as { code?: string }).code ?? error.message) : String(error);
  console.error(`[${where}]`, detail);
  return Response.json({ error: 'server_error' }, { status: 500 });
}

/** The plain sentence to show a player for a route's error response. */
export function describeRouteError(): string {
  return 'Something went wrong on our end. Please try again.';
}
