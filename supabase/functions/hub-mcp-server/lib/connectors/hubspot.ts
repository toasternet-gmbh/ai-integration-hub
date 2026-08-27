/**
 * HubSpot connector — CRM (the Hub's first CRM platform). Auth: `Authorization: Bearer
 * {accessToken}` using a Private App access token (Settings → Integrations → Private Apps),
 * HubSpot's standard server-to-server auth since legacy static API keys were retired in 2022.
 * Docs: developers.hubspot.com/docs/api/crm/contacts, .../deals.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const BASE = "https://api.hubapi.com";

export interface HubSpotCredentials {
  accessToken: string;
}

export class HubSpotConnector implements Connector {
  constructor(private creds: HubSpotCredentials) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.creds.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `HubSpot HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/crm/v3/objects/contacts?limit=1");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
      { domain: "deals", tools: ["deals.search", "deals.get"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "contacts.search": {
        const email = input.email ? String(input.email) : "";
        const name = input.name ? String(input.name) : "";
        if (email || name) {
          const filters = email
            ? [{ propertyName: "email", operator: "CONTAINS_TOKEN", value: email }]
            : [{ propertyName: "firstname", operator: "CONTAINS_TOKEN", value: name }];
          const data = await this.request("/crm/v3/objects/contacts/search", {
            method: "POST",
            body: JSON.stringify({ filterGroups: [{ filters }], properties: ["email", "firstname", "lastname"], limit: input.page ? undefined : 25 }),
          });
          return { data };
        }
        const data = await this.request("/crm/v3/objects/contacts?limit=25");
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`);
        return { data };
      }
      case "deals.search": {
        const params = new URLSearchParams();
        params.set("limit", String(input.limit ?? 25));
        const data = await this.request(`/crm/v3/objects/deals?${params.toString()}`);
        return { data };
      }
      case "deals.get": {
        const dealId = String(input.deal_id ?? "");
        if (!dealId) throw new Error("deal_id is required.");
        const data = await this.request(`/crm/v3/objects/deals/${encodeURIComponent(dealId)}`);
        return { data };
      }
      default:
        throw new Error(`HubSpot connector does not support tool '${tool}'.`);
    }
  }
}
