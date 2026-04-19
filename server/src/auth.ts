import type { MiddlewareHandler } from 'hono';

export function bearerAuth(expectedToken: string): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (match?.[1] !== expectedToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };
}
