/**
 * AES-256-GCM encrypt/decrypt for integration credentials at rest (blueprint §20: "never expose
 * credentials to Agents", "encrypt credentials at rest"). Key comes from CREDENTIALS_ENCRYPTION_KEY
 * (32 raw bytes, base64) — set once per deployment, never rotated without a re-encrypt migration.
 *
 * Ciphertext layout stored in integrations.credentials_encrypted: base64(iv[12] || ciphertext+tag).
 */

async function getKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY");
  if (!b64) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not configured");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCredentials(plaintext: Record<string, unknown>): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(plaintext));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptCredentials(stored: string): Promise<Record<string, unknown>> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
