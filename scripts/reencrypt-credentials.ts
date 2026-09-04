#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * scripts/reencrypt-credentials.ts — rewrites every stored integration credential from the old
 * (retiring) key to the new (active) one, closing out an encryption-key rotation.
 *
 * Rotation procedure:
 *   1. Generate a new key:              openssl rand -base64 32
 *   2. Deploy with BOTH keys set — the new one active, the old one kept for decrypt fallback:
 *        CREDENTIALS_ENCRYPTION_KEY=<new key>
 *        CREDENTIALS_ENCRYPTION_KEY_PREVIOUS=<old key>
 *      (see deploy.sh / .env.supabase — reads and writes both keep working at this point, since
 *      lib/crypto.ts tries the active key first and falls back through _PREVIOUS on decrypt)
 *   3. Run this script against that same deployment's database:
 *        SUPABASE_URL=https://your-project-or-kong-host \
 *        SUPABASE_SERVICE_ROLE_KEY=<service role key> \
 *        CREDENTIALS_ENCRYPTION_KEY=<new key> \
 *        CREDENTIALS_ENCRYPTION_KEY_PREVIOUS=<old key> \
 *        deno run --allow-net --allow-env scripts/reencrypt-credentials.ts
 *   4. Only once it reports zero failures, remove CREDENTIALS_ENCRYPTION_KEY_PREVIOUS and redeploy
 *      — removing it before every row is confirmed rotated makes any row this script hasn't
 *      reached yet permanently undecryptable.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptCredentials, encryptCredentials } from "../supabase/functions/hub-mcp-server/lib/crypto.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_INTERNAL_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  Deno.exit(1);
}
if (!Deno.env.get("CREDENTIALS_ENCRYPTION_KEY")) {
  console.error("❌ CREDENTIALS_ENCRYPTION_KEY (the new, active key) is required.");
  Deno.exit(1);
}
if (!Deno.env.get("CREDENTIALS_ENCRYPTION_KEY_PREVIOUS")) {
  console.error(
    "❌ CREDENTIALS_ENCRYPTION_KEY_PREVIOUS (the old key being retired) is required — without it " +
      "this script can't decrypt rows still encrypted under the old key.",
  );
  Deno.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey);

const { data: rows, error } = await admin.from("hub_integrations").select("id, name, credentials_encrypted");
if (error) {
  console.error("❌ Failed to list integrations:", error.message);
  Deno.exit(1);
}

console.log(`Rotating ${rows?.length ?? 0} integration credential(s)...\n`);

let rotated = 0;
let failed = 0;

for (const row of rows ?? []) {
  try {
    // Re-encrypt unconditionally rather than trying to detect "already under the new key" — a
    // fresh random IV means the stored bytes change on every encrypt regardless, so there's no
    // cheap way to tell from the ciphertext alone, and re-encrypting an already-current row is
    // harmless.
    const plaintext = await decryptCredentials(row.credentials_encrypted);
    const reencrypted = await encryptCredentials(plaintext);
    const { error: updErr } = await admin.from("hub_integrations").update({ credentials_encrypted: reencrypted }).eq("id", row.id);
    if (updErr) throw new Error(updErr.message);
    rotated++;
    console.log(`✅ ${row.name} (${row.id})`);
  } catch (err) {
    failed++;
    console.error(`❌ ${row.name} (${row.id}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\nDone. ${rotated} rotated, ${failed} failed, ${rows?.length ?? 0} total.`);
if (failed > 0) {
  console.error(
    "\n⚠️  Do NOT remove CREDENTIALS_ENCRYPTION_KEY_PREVIOUS yet — the row(s) above are still only " +
      "decryptable under the old key. Fix whatever's failing and re-run before dropping it.",
  );
  Deno.exit(1);
}
