/** In-memory sliding-window rate limiter — mirrors newsletter-signup/index.ts's checkRateLimit
 *  pattern. In-memory means limits reset on a function restart and don't share state across
 *  replicas, which is fine for this single-container local/dev deployment; swap for a shared store
 *  (e.g. a rate_limits table or Redis) before running multiple replicas in production. */
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= maxRequests) {
    const retryAfterMs = windowMs - (now - hits[0]);
    return { allowed: false, retryAfterMs };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfterMs: 0 };
}

/** Non-mutating check, for gating a request BEFORE it does the thing being limited (e.g. before
 *  attempting auth) without that gate check itself counting as a hit. */
export function isOverLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  return hits.length >= maxRequests;
}

/** Records one hit against a key without an allow/deny decision — for counting failures (e.g. a
 *  failed auth attempt) that should count toward isOverLimit on the *next* request, not this one. */
export function recordHit(key: string, windowMs: number): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
}

export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}
