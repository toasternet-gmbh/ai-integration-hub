/**
 * Blocks a connector's user-supplied storeUrl/siteUrl from targeting loopback, private-network, or
 * cloud-metadata addresses before it's ever fetch()ed — every project member can set this URL via
 * create_integration, and the edge function that fetches it runs with network access to this
 * stack's own internal services (Postgres, Kong, GoTrue, ...) and, in a cloud deployment, the
 * instance metadata endpoint.
 *
 * This checks the literal hostname/IP in the URL, which stops the common case (someone just types
 * "http://localhost:5432" or an internal Docker hostname). It does NOT protect against DNS
 * rebinding — a hostname that resolves to a public IP now but a private one at actual fetch time —
 * which would need a custom resolver/dispatcher wired into every connector's fetch calls. Treat
 * this as a real but partial mitigation, not a complete one.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

function isPrivateIPv4(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n < 0 || n > 255)) return false;
  return (
    a === 127 || // loopback
    a === 10 || // private
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 169 && b === 254) || // link-local, incl. cloud metadata (169.254.169.254)
    a === 0
  );
}

function isPrivateIPv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return h === "::1" || h === "::" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd");
}

export function assertPublicHttpUrl(rawUrl: string, fieldLabel = "URL"): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${fieldLabel} is not a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${fieldLabel} must be an http:// or https:// URL.`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    throw new Error(`${fieldLabel} may not point at a local, private-network, or cloud-metadata address.`);
  }
}
