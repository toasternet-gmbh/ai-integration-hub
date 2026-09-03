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
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "deals", tools: ["deals.search", "deals.get", "deals.create"] },
      { domain: "companies", tools: ["companies.search", "companies.get"] },
      { domain: "associations", tools: ["associations.list", "associations.create"] },
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
      // POST /crm/v3/objects/contacts is a real, confirmed endpoint (developers.hubspot.com).
      case "contacts.create": {
        const email = input.email ? String(input.email) : undefined;
        const name = input.name ? String(input.name) : "";
        const [firstname, ...rest] = name.split(" ");
        const properties: Record<string, string> = {};
        if (email) properties.email = email;
        if (firstname) properties.firstname = firstname;
        if (rest.length > 0) properties.lastname = rest.join(" ");
        const data = await this.request("/crm/v3/objects/contacts", { method: "POST", body: JSON.stringify({ properties }) });
        return { data };
      }
      // POST /crm/v3/objects/deals is real and confirmed, but requires a valid `dealstage` id from
      // the account's own pipeline -- there's no universal default id across accounts. If the
      // caller doesn't supply one, this looks up the account's pipelines (GET
      // /crm/v3/pipelines/deals, also real and confirmed) and uses the first stage of whichever
      // pipeline has the lowest displayOrder (HubSpot's own "default pipeline" convention).
      case "deals.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        let stage = input.stage ? String(input.stage) : "";
        if (!stage) {
          const pipelines = (await this.request("/crm/v3/pipelines/deals")) as {
            results?: { displayOrder: number; stages?: { id: string; displayOrder: number }[] }[];
          };
          const sorted = (pipelines.results ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
          const firstStage = sorted[0]?.stages?.slice().sort((a, b) => a.displayOrder - b.displayOrder)[0];
          if (!firstStage) throw new Error("Could not resolve a default deal stage -- pass 'stage' explicitly.");
          stage = firstStage.id;
        }
        const properties: Record<string, unknown> = { dealname: name, dealstage: stage };
        if (input.amount != null) properties.amount = input.amount;
        const data = await this.request("/crm/v3/objects/deals", { method: "POST", body: JSON.stringify({ properties }) });
        return { data };
      }
      // Companies are a real, distinct third CRM object alongside contacts/deals -- same
      // /crm/v3/objects/{type} shape (developers.hubspot.com).
      case "companies.search": {
        const name = input.name ? String(input.name) : "";
        if (name) {
          const data = await this.request("/crm/v3/objects/companies/search", {
            method: "POST",
            body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "name", operator: "CONTAINS_TOKEN", value: name }] }], properties: ["name", "domain"], limit: 25 }),
          });
          return { data };
        }
        const data = await this.request(`/crm/v3/objects/companies?limit=${Number(input.limit ?? 25)}`);
        return { data };
      }
      case "companies.get": {
        const companyId = String(input.company_id ?? "");
        if (!companyId) throw new Error("company_id is required.");
        const data = await this.request(`/crm/v3/objects/companies/${encodeURIComponent(companyId)}`);
        return { data };
      }
      // GET .../associations/{toObjectType} is real and confirmed. Uses HubSpot's newer
      // date-versioned API path (2026-03) rather than the /crm/v4/ alias -- HubSpot's own
      // migration guidance is that v4 is being phased out in favor of dated versions for anything
      // built from here on (developers.hubspot.com/changelog/deprecating-support-for-hubspot-v4-apis).
      // object_type/to_object_type are passed straight through (contacts/companies/deals) -- these
      // already match HubSpot's own object-type slugs, no translation needed.
      case "associations.list": {
        const objectType = String(input.object_type ?? "");
        const objectId = String(input.object_id ?? "");
        const toObjectType = String(input.to_object_type ?? "");
        if (!objectType || !objectId || !toObjectType) throw new Error("object_type, object_id, and to_object_type are required.");
        const data = await this.request(`/crm/objects/2026-03/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/associations/${encodeURIComponent(toObjectType)}`);
        return { data };
      }
      // PUT .../associations/default/{toObjectType}/{toObjectId} is HubSpot's own "unlabeled
      // default association" shortcut -- deliberately used instead of the general labeled-
      // association endpoint, which requires knowing a specific associationTypeId that varies per
      // object-type pair and per account (no universal constant to default to).
      case "associations.create": {
        const objectType = String(input.object_type ?? "");
        const objectId = String(input.object_id ?? "");
        const toObjectType = String(input.to_object_type ?? "");
        const toObjectId = String(input.to_object_id ?? "");
        if (!objectType || !objectId || !toObjectType || !toObjectId) throw new Error("object_type, object_id, to_object_type, and to_object_id are required.");
        const data = await this.request(
          `/crm/objects/2026-03/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/associations/default/${encodeURIComponent(toObjectType)}/${encodeURIComponent(toObjectId)}`,
          { method: "PUT" },
        );
        return { data };
      }
      default:
        throw new Error(`HubSpot connector does not support tool '${tool}'.`);
    }
  }
}
