/** Connector interface (blueprint §26). A connector maps canonical tools to one platform's native
 *  API — it never decides whether an agent is allowed to call a tool; that's the pipeline's job. */

export interface ConnectionResult {
  ok: boolean;
  message: string;
}

export interface Capability {
  domain: string;
  tools: string[];
}

export interface ToolResult {
  // deno-lint-ignore no-explicit-any
  data: any;
}

export interface Connector {
  testConnection(): Promise<ConnectionResult>;
  getCapabilities(): Promise<Capability[]>;
  execute(tool: string, input: Record<string, unknown>): Promise<ToolResult>;
}
