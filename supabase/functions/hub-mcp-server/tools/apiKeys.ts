/** API key CRUD — `hub_` prefixed keys, hashed the same way ../lib/mcpAuth.ts hashes them on
 *  the way in. The raw key is only ever returned once, from create_api_key. */
import type { ToolDefinition, ToolModule } from "../lib/types.ts";

async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `hub_live_${raw}`;
}

export const definitions: ToolDefinition[] = [
  {
    name: "create_api_key",
    description: "Create a new project-scoped API key. Returns the raw key exactly once — it is not recoverable afterwards.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
  },
  {
    name: "list_api_keys",
    description: "List this project's API keys (masked — never returns the raw key).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "revoke_api_key",
    description: "Permanently revoke an API key.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
  },
];

export const handlers: ToolModule["handlers"] = {
  async create_api_key(args, { admin, projectId, userId }) {
    const name = String(args.name ?? "").trim();
    if (!name) throw new Error("name is required.");
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const { data, error } = await admin
      .from("hub_api_keys")
      .insert({ project_id: projectId, name, key_hash: keyHash, created_by: userId })
      .select("id, name, created_at").single();
    if (error) throw new Error(error.message);
    return { ...data, key: rawKey };
  },

  async list_api_keys(_args, { admin, projectId }) {
    const { data, error } = await admin
      .from("hub_api_keys").select("id, name, key_hash, last_used_at, created_at")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: { key_hash: string; [k: string]: unknown }) => ({
      id: row.id, name: row.name, last_used_at: row.last_used_at, created_at: row.created_at,
      key_suffix: row.key_hash.slice(-4),
    }));
  },

  async revoke_api_key(args, { admin, projectId }) {
    const id = String(args.id ?? "");
    if (!id) throw new Error("id is required.");
    const { error } = await admin.from("hub_api_keys").delete().eq("id", id).eq("project_id", projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};
