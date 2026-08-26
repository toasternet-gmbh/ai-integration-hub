/** Shared types for mcp-server tool modules — mirrors yogaipilot's mcp-server/tools/types.ts. */

// deno-lint-ignore no-explicit-any
export type SupabaseAdmin = any;

export interface ToolContext {
  /** Always the service-role client — every table here is reached through the tool pipeline, not RLS. */
  admin: SupabaseAdmin;
  projectId: string;
  /** The human (JWT caller) or null for a pure API-key/service call with no human behind it. */
  userId: string | null;
}

export interface ToolDefinition {
  name: string;
  description: string;
  // deno-lint-ignore no-explicit-any
  inputSchema: Record<string, any>;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

export interface ToolModule {
  definitions: ToolDefinition[];
  handlers: Record<string, ToolHandler>;
}
