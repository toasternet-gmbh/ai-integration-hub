/** Aggregates every ./tools/*.ts module into the flat TOOLS list + name->handler map index.ts needs. */
import * as orders from "./tools/orders.ts";
import * as integrations from "./tools/integrations.ts";
import * as agents from "./tools/agents.ts";
import * as approvals from "./tools/approvals.ts";
import * as organizations from "./tools/organizations.ts";
import type { ToolDefinition, ToolHandler, ToolModule } from "../_shared/types.ts";

const MODULES: ToolModule[] = [orders, integrations, agents, approvals, organizations];

export const TOOLS: ToolDefinition[] = MODULES.flatMap((m) => m.definitions);

export const HANDLERS: Record<string, ToolHandler> = Object.fromEntries(
  MODULES.flatMap((m) => Object.entries(m.handlers)),
);

/** Tools that don't mutate state, and admin/meta tools — always allowed for an agent, never gated
 *  by agent_tool_permissions (which only makes sense for the canonical domain tools like orders.*). */
export function isGatedTool(name: string): boolean {
  return name.startsWith("orders.");
}
