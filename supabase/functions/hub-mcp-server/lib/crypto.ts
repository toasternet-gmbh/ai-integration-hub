/**
 * AES-256-GCM encrypt/decrypt for integration credentials at rest (blueprint §20: "never expose
 * credentials to Agents", "encrypt credentials at rest"). Active key comes from
 * CREDENTIALS_ENCRYPTION_KEY (32 raw bytes, base64) — used for every encrypt and tried first on
 * decrypt. CREDENTIALS_ENCRYPTION_KEY_PREVIOUS (optional, comma-separated for more than one
 * retired key) holds keys kept live for decrypt-only during a rotation: deploy with the new key as
 * CREDENTIALS_ENCRYPTION_KEY and the old one moved to _PREVIOUS, run
 * scripts/reencrypt-credentials.ts to rewrite every row under the new key alone, then drop
 * _PREVIOUS. Losing every key that ever encrypted a still-live row is still unrecoverable — this
 * only removes the need to do that rewrite in one atomic, no-downtime step.
 *
 * Ciphertext layout stored in integrations.credentials_encrypted: base64(iv[12] || ciphertext+tag).
 */

async function importKey(b64: string, label: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error(`${label} must decode to exactly 32 bytes`);
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function activeKeyB64(): string {
  const b64 = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY");
  if (!b64) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not configured");
  return b64;
}

function previousKeysB64(): string[] {
  const raw = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY_PREVIOUS");
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function encryptCredentials(plaintext: Record<string, unknown>): Promise<string> {
  const key = await importKey(activeKeyB64(), "CREDENTIALS_ENCRYPTION_KEY");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(plaintext));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptCredentials(stored: string): Promise<Record<string, unknown>> {
  const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Try the active key first (the common case costs nothing extra), then fall back through
  // retired keys — lets old rows keep decrypting through a rotation window instead of going dark
  // the moment CREDENTIALS_ENCRYPTION_KEY changes.
  const candidates = [activeKeyB64(), ...previousKeysB64()];
  let lastErr: unknown;
  for (const b64 of candidates) {
    try {
      const key = await importKey(b64, "a configured encryption key");
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
      return JSON.parse(new TextDecoder().decode(plaintext));
    } catch (err) {
      lastErr = err;
    }
  }
  const triedPrevious = candidates.length > 1 ? ` (also tried ${candidates.length - 1} key(s) from CREDENTIALS_ENCRYPTION_KEY_PREVIOUS)` : "";
  throw new Error(`Failed to decrypt credentials with the configured key${triedPrevious}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}
