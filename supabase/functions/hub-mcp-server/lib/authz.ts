/**
 * Shared authorization checks for tool handlers that must be restricted to a human project owner —
 * i.e. NOT reachable by an agent acting through the project's own API key. `userId` is only ever
 * set for a JWT-authenticated (human) caller (see ToolContext in lib/types.ts); an API-key call
 * always has `userId: null`, so checking it first is what actually excludes agents here, not the
 * role lookup alone.
 */
// deno-lint-ignore no-explicit-any
export async function requireOwner(admin: any, projectId: string, userId: string | null): Promise<void> {
  if (!userId) throw new Error("This action requires a signed-in project owner — an API key alone is not enough.");
  const { data, error } = await admin.from("hub_project_members").select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "owner") throw new Error("Only a project owner can perform this action.");
}
