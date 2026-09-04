/** Shared byte-to-base64 encoding — Deno's `btoa` only accepts a "binary string" (one char per
 *  byte), not a raw `ArrayBuffer`/`Uint8Array`, so every connector that needs to base64-encode a
 *  fetched binary response (a screenshot, a PDF, a Gmail MIME message) has to bridge that gap
 *  itself. Previously reimplemented independently in google.ts, browserless.ts, and steel.ts —
 *  consolidated here so a future fix (e.g. chunking for very large buffers) only needs to happen
 *  once. */
export function bytesToBase64(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Base64url variant (RFC 4648 §5) — used where the target API forbids `+`/`/`/padding, e.g.
 *  Gmail's `messages.send` `raw` field. */
export function bytesToBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function stringToBase64Url(input: string): string {
  return bytesToBase64Url(new TextEncoder().encode(input));
}
