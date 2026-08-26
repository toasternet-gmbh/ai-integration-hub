/** Banking (GoCardless Bank Account Data) — the one category whose connect flow isn't a
 *  credentials form but a consent redirect. `start_bank_connection` creates a pending integration
 *  + a GoCardless requisition and hands back the URL to redirect the user to; the user consents
 *  at their bank and GoCardless redirects back to the Hub with `?ref=<integration_id>` (the
 *  requisition's `reference`, set to the integration's own id below — no separate lookup table
 *  needed). The frontend then calls `complete_bank_connection` with that id to finalize.
 *
 *  `accounts.list`/`transactions.search` are the only gated canonical tools — read-only by
 *  design; payment initiation is a distinct compliance/licensing question, deliberately not
 *  bundled in here. */
import type { SupabaseAdmin, ToolDefinition, ToolModule } from "../lib/types.ts";
import { encryptCredentials, decryptCredentials } from "../lib/crypto.ts";
import { loadConnector } from "../lib/connectors/factory.ts";
import { createRequisition, getRequisition, listInstitutions } from "../lib/gocardless.ts";

const SAFE_COLUMNS = "id, project_id, platform, name, status, capabilities, last_sync_at, error_status, created_at";

// No connected-status check here (unlike the other tools/*.ts requireIntegration helpers) —
// complete_bank_connection legitimately needs to load a still-pending integration to finalize it.
async function findIntegration(admin: SupabaseAdmin, projectId: string, integrationId: string) {
  const { data, error } = await admin
    .from("hub_integrations")
    .select("id, platform, credentials_encrypted, status")
    .eq("id", integrationId).eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Integration ${integrationId} not found in this project`);
  return data;
}

async function requireConnectedIntegration(admin: SupabaseAdmin, projectId: string, integrationId: string) {
  const data = await findIntegration(admin, projectId, integrationId);
  if (data.status !== "connected") throw new Error(`Integration ${integrationId} is not connected (status: ${data.status})`);
  return data;
}

export const definitions: ToolDefinition[] = [
  {
    name: "list_bank_institutions",
    description: "List banks GoCardless can connect to in a given country.",
    inputSchema: { type: "object", required: ["country"], properties: { country: { type: "string", description: "ISO 3166-1 alpha-2, e.g. 'de'" } } },
  },
  {
    name: "start_bank_connection",
    description: "Begin connecting a bank account via GoCardless. Returns a redirect_url to send the user to for consent.",
    inputSchema: {
      type: "object",
      required: ["institution_id", "name", "redirect_url"],
      properties: { institution_id: { type: "string" }, name: { type: "string" }, redirect_url: { type: "string" } },
    },
  },
  {
    name: "complete_bank_connection",
    description: "Finalize a bank connection after the user returns from GoCardless consent. Safe to call again if still pending.",
    inputSchema: { type: "object", required: ["integration_id"], properties: { integration_id: { type: "string" } } },
  },
  {
    name: "accounts.list",
    description: "List linked bank accounts with balances on a banking integration.",
    inputSchema: { type: "object", required: ["integration_id"], properties: { integration_id: { type: "string" } } },
  },
  {
    name: "transactions.search",
    description: "Search transactions on a linked bank account.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        account_id: { type: "string", description: "Defaults to the integration's first linked account." },
        date_from: { type: "string", description: "ISO 8601 date" },
        date_to: { type: "string", description: "ISO 8601 date" },
      },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async list_bank_institutions(args) {
    return listInstitutions(String(args.country ?? ""));
  },

  async start_bank_connection(args, { admin, projectId }) {
    const institutionId = String(args.institution_id ?? "");
    const name = String(args.name ?? "").trim();
    const redirectUrl = String(args.redirect_url ?? "");
    if (!institutionId || !name || !redirectUrl) throw new Error("institution_id, name, and redirect_url are required.");

    const { data: platformType, error: platformErr } = await admin.from("hub_platform_types").select("enabled").eq("name", "gocardless").maybeSingle();
    if (platformErr) throw new Error(platformErr.message);
    if (platformType && !platformType.enabled) throw new Error("Platform 'gocardless' is disabled Hub-wide.");

    const { data: row, error } = await admin
      .from("hub_integrations")
      .insert({ project_id: projectId, platform: "gocardless", name, credentials_encrypted: await encryptCredentials({}), status: "pending" })
      .select("id").single();
    if (error) throw new Error(error.message);

    try {
      const requisition = await createRequisition({ institutionId, redirectUrl, reference: row.id });
      await admin
        .from("hub_integrations")
        .update({ credentials_encrypted: await encryptCredentials({ requisitionId: requisition.id, accountIds: [] }) })
        .eq("id", row.id);
      return { integration_id: row.id, redirect_url: requisition.link };
    } catch (err) {
      await admin.from("hub_integrations").update({ status: "error", error_status: (err as Error).message }).eq("id", row.id);
      throw err;
    }
  },

  async complete_bank_connection(args, { admin, projectId }) {
    const integrationId = String(args.integration_id ?? "");
    const integration = await findIntegration(admin, projectId, integrationId);
    const creds = (await decryptCredentials(integration.credentials_encrypted)) as { requisitionId?: string };
    if (!creds.requisitionId) throw new Error("This integration was not started as a bank connection.");

    const requisition = await getRequisition(creds.requisitionId);
    if (!requisition.accounts?.length) {
      const { data: updated, error: updErr } = await admin
        .from("hub_integrations")
        .update({ status: "pending", error_status: `Consent not completed yet (status: ${requisition.status}).` })
        .eq("id", integrationId).select(SAFE_COLUMNS).single();
      if (updErr) throw new Error(updErr.message);
      return updated;
    }

    const encrypted = await encryptCredentials({ requisitionId: creds.requisitionId, accountIds: requisition.accounts });
    const connector = await loadConnector({ platform: "gocardless", credentials_encrypted: encrypted });
    const capabilities = await connector.getCapabilities();
    const { data: updated, error: updErr } = await admin
      .from("hub_integrations")
      .update({ credentials_encrypted: encrypted, status: "connected", error_status: null, capabilities })
      .eq("id", integrationId).select(SAFE_COLUMNS).single();
    if (updErr) throw new Error(updErr.message);
    return updated;
  },

  async "accounts.list"(args, { admin, projectId }) {
    const integration = await requireConnectedIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("accounts.list", args)).data;
  },

  async "transactions.search"(args, { admin, projectId }) {
    const integration = await requireConnectedIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("transactions.search", args)).data;
  },
};
