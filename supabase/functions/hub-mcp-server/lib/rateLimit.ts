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

/**
 * Client IP for rate-limit bucketing. Verified against this stack's actual proxy chain (Kong in
 * front of the edge-functions container, `docker logs` inspected directly): Kong overwrites
 * X-Real-IP with the peer address it itself observed — a client-supplied X-Real-IP is discarded,
 * not forwarded — and appends that same address as the LAST entry of X-Forwarded-For. Earlier
 * X-Forwarded-For entries (including its first, which the previous version of this function
 * trusted) are exactly what a client sent and are fully attacker-controlled — trusting them let
 * anyone bypass both the per-IP and failed-auth rate limits by rotating the header per request.
 *
 * X-Real-IP is checked first as the simplest reliable signal; the last X-Forwarded-For entry is
 * an equivalent fallback for a differently-shaped proxy chain. Neither is the literal origin
 * client if more trusted hops sit in front of Kong (e.g. Caddy) — this is a coarse anti-abuse
 * backstop (see index.ts), not a precision limiter, and a value no client can directly set is the
 * property that actually matters here.
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return "unknown";
}
