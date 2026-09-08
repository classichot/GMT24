import "server-only";

/** Fixed-window limiter keyed by client address. In-memory per instance; enough to protect the public scan entry point. */
const WINDOWS = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; retryAfterS: number } {
  const now = Date.now();
  const w = WINDOWS.get(key);
  if (!w || w.resetAt < now) { WINDOWS.set(key, { count: 1, resetAt: now + windowMs }); return { ok: true, remaining: limit - 1, retryAfterS: 0 }; }
  w.count += 1;
  if (w.count > limit) return { ok: false, remaining: 0, retryAfterS: Math.ceil((w.resetAt - now) / 1000) };
  return { ok: true, remaining: limit - w.count, retryAfterS: 0 };
}

export function clientKey(req: Request): string {
  const h = req.headers;
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}
