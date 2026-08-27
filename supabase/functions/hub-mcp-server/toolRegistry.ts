/** Aggregates every ./tools/*.ts module into the flat TOOLS list + name->handler map index.ts needs. */
import * as orders from "./tools/orders.ts";
import * as products from "./tools/products.ts";
import * as inventory from "./tools/inventory.ts";
import * as bookkeeping from "./tools/bookkeeping.ts";
import * as cms from "./tools/cms.ts";
import * as timeEntries from "./tools/timeEntries.ts";
import * as banking from "./tools/banking.ts";
import * as crm from "./tools/crm.ts";
import * as integrations from "./tools/integrations.ts";
import * as agents from "./tools/agents.ts";
import * as approvals from "./tools/approvals.ts";
import * as organizations from "./tools/organizations.ts";
import * as apiKeys from "./tools/apiKeys.ts";
import * as members from "./tools/members.ts";
import * as account from "./tools/account.ts";
import * as platformAdmin from "./tools/platformAdmin.ts";
import type { ToolDefinition, ToolHandler, ToolModule } from "./lib/types.ts";

const MODULES: ToolModule[] = [orders, products, inventory, bookkeeping, cms, timeEntries, banking, crm, integrations, agents, approvals, organizations, apiKeys, members, account, platformAdmin];

export const TOOLS: ToolDefinition[] = MODULES.flatMap((m) => m.definitions);

export const HANDLERS: Record<string, ToolHandler> = Object.fromEntries(
  MODULES.flatMap((m) => Object.entries(m.handlers)),
);

/** Domain prefixes for canonical tools that act on a connected external system — these go through
 *  the Policy Engine (agent_tool_permissions, approvals, audit log). Everything else (admin/meta
 *  tools like create_integration, create_agent, list_approvals, ...) is always allowed for an
 *  agent, no gating. New domain added by a new connector? Add its prefix here too. */
const GATED_DOMAIN_PREFIXES = ["orders.", "products.", "inventory.", "invoices.", "contacts.", "cms.", "time_entries.", "accounts.", "transactions.", "deals."];

export function isGatedTool(name: string): boolean {
  return GATED_DOMAIN_PREFIXES.some((prefix) => name.startsWith(prefix));
}
