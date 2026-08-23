/**
 * Auth for the MCP gateway — mirrors yogaipilot's _shared/mcpAuth.ts pattern (API key / JWT), minus
 * the OAuth-discovery dance (not needed for Milestone 1; a Hub client authenticates with either a
 * project-scoped API key, or a human's own Supabase JWT plus an explicit project_id param).
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}

export type McpAuthContext =
  | { authType: "api_key"; projectId: string; userId: null }
  | { authType: "jwt"; projectId: string; userId: string };

async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolves the caller's project. An API key is already project-scoped. A JWT caller must also pass
 * `project_id` in the JSON-RPC params — the JWT alone only proves who they are, not which project
 * they're acting on (unlike yogaipilot's one-tenant-per-user model, this Hub's users can belong to
 * several projects at once).
 */
export async function authenticateMcpRequest(
  req: Request,
  // deno-lint-ignore no-explicit-any
  admin: any,
  supabaseUrl: string,
  anonKey: string,
  requestedProjectId: string | undefined,
): Promise<McpAuthContext> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new McpAuthError("Missing Authorization: Bearer token");
  const token = authHeader.slice("Bearer ".length).trim();

  if (token.startsWith("hub_")) {
    const hash = await hashApiKey(token);
    const { data, error } = await admin.from("api_keys").select("id, project_id").eq("key_hash", hash).maybeSingle();
    if (error) throw new McpAuthError(error.message);
    if (!data) throw new McpAuthError("Invalid API key");
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
    return { authType: "api_key", projectId: data.project_id, userId: null };
  }

  // Otherwise treat it as a Supabase user JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) throw new McpAuthError("Invalid or expired session");

  // No project_id yet is valid for the bootstrap tools (create_organization/create_project) — any
  // other tool handler that needs a real project will simply find ctx.projectId empty and fail its
  // own project_id filter/lookup, which is an acceptable failure mode for those (rare) calls.
  if (!requestedProjectId) return { authType: "jwt", projectId: "", userId: user.id };

  const { data: membership, error: memErr } = await admin
    .from("project_members").select("project_id").eq("project_id", requestedProjectId).eq("user_id", user.id).maybeSingle();
  if (memErr) throw new McpAuthError(memErr.message);
  if (!membership) throw new McpAuthError(`Not a member of project ${requestedProjectId}`);

  return { authType: "jwt", projectId: requestedProjectId, userId: user.id };
}
