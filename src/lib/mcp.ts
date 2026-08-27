import { supabase } from "./supabase";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hub-mcp-server`;

/** Calls one MCP tool as the signed-in user. `projectId` omitted for bootstrap tools
 *  (create_organization/create_project); `agentId` only needed for orders.* calls. */
export async function mcp<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
  opts: { projectId?: string; agentId?: string } = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in");

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  if (opts.agentId) headers["X-Agent-Id"] = opts.agentId;

  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: { ...args, project_id: opts.projectId } },
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? json?.msg ?? `HTTP ${res.status}`);
  if (!json) throw new Error(`HTTP ${res.status}`);
  if (json.error) throw new Error(json.error.message);

  const text: string | undefined = json.result?.content?.[0]?.text;
  const parsed = text !== undefined ? safeParse(text) : json.result;
  if (json.result?.isError) throw new Error(typeof parsed === "string" ? parsed : (text ?? "Tool error"));
  return parsed as T;
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
