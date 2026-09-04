/**
 * Pipedrive connector — CRM. Auth: `x-api-token: {apiToken}` header against the v2 REST API,
 * which is company-domain-scoped (`https://{companyDomain}.pipedrive.com/api/v2`) — the token
 * itself is also per-company, so both fields are required credentials, unlike single-tenant APIs
 * like HubSpot's. Docs: pipedrive.readme.io/docs/core-api-concepts-authentication,
 * developers.pipedrive.com/docs/api/v2.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface PipedriveCredentials {
  companyDomain: string;
  apiToken: string;
}

export class PipedriveConnector implements Connector {
  constructor(private creds: PipedriveCredentials) {}

  private get base(): string {
    return `https://${this.creds.companyDomain}.pipedrive.com/api/v2`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { ...init.headers, "x-api-token": this.creds.apiToken, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: string })?.error ?? `Pipedrive HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/deals?limit=1");
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
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      // GET /persons/search?term= is Pipedrive's dedicated search endpoint (v2 keeps v1's
      // /{item}/search shape) — used instead of the plain list endpoint whenever a filter is
      // given, same posture as HubSpot's contacts.search using its /search endpoint only when a
      // filter is present.
      case "contacts.search": {
        const email = input.email ? String(input.email) : "";
        const name = input.name ? String(input.name) : "";
        const term = email || name;
        if (term) {
          const params = new URLSearchParams({ term, fields: email ? "email" : "name" });
          const data = await this.request(`/persons/search?${params.toString()}`);
          return { data };
        }
        const data = await this.request("/persons?limit=25");
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/persons/${encodeURIComponent(contactId)}`);
        return { data };
      }
      case "contacts.create": {
        const email = input.email ? String(input.email) : undefined;
        const name = input.name ? String(input.name) : "";
        if (!name) throw new Error("name is required.");
        const body: Record<string, unknown> = { name };
        if (email) body.emails = [{ value: email, primary: true }];
        const data = await this.request("/persons", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "deals.search": {
        const data = await this.request(`/deals?limit=${Number(input.limit ?? 25)}`);
        return { data };
      }
      case "deals.get": {
        const dealId = String(input.deal_id ?? "");
        if (!dealId) throw new Error("deal_id is required.");
        const data = await this.request(`/deals/${encodeURIComponent(dealId)}`);
        return { data };
      }
      // POST /deals is real and confirmed (developers.pipedrive.com/docs/api/v2/Deals). `title` is
      // the only required field; `value` maps our canonical `amount`. `stage_id` has no universal
      // default across pipelines (same problem HubSpot's dealstage has) — if the caller omits it,
      // Pipedrive itself falls back to the pipeline's first stage, so it's left unset rather than
      // guessed.
      case "deals.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const body: Record<string, unknown> = { title: name };
        if (input.amount != null) body.value = input.amount;
        if (input.stage) body.stage_id = Number(input.stage);
        const data = await this.request("/deals", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      // Organizations are Pipedrive's "companies" object — same /search + plain-list shape as
      // persons/deals (developers.pipedrive.com/docs/api/v2/Organizations).
      case "companies.search": {
        const name = input.name ? String(input.name) : "";
        if (name) {
          const params = new URLSearchParams({ term: name, fields: "name" });
          const data = await this.request(`/organizations/search?${params.toString()}`);
          return { data };
        }
        const data = await this.request(`/organizations?limit=${Number(input.limit ?? 25)}`);
        return { data };
      }
      case "companies.get": {
        const companyId = String(input.company_id ?? "");
        if (!companyId) throw new Error("company_id is required.");
        const data = await this.request(`/organizations/${encodeURIComponent(companyId)}`);
        return { data };
      }
      default:
        throw new Error(`Pipedrive connector does not support tool '${tool}'.`);
    }
  }
}
