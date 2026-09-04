/**
 * weclapp connector — ERP (CRM + bookkeeping + inventory + time tracking in one SaaS suite; this
 * connector only implements the contacts/invoices slice, the same "cover what's confirmed, not
 * the whole 150+ entity surface" posture as every other multi-domain connector in this codebase).
 * Auth: per-user `AuthenticationToken` header (My Settings → API in the weclapp UI). The REST API
 * is tenant-scoped: `https://{tenant}.weclapp.com/webapp/api/v1/`. Docs: weclapp.com/api2/ (every
 * tenant also serves its own interactive Swagger UI for its API version).
 *
 * weclapp's newer API consolidates customers/suppliers/leads/contacts into one `/party` resource,
 * distinguished by a `partyType` (PERSON/ORGANIZATION) plus boolean role flags — this connector
 * always creates `ORGANIZATION` parties, since the canonical contacts.create schema only carries
 * a single `name` field (company name or full person name), not separate first/last name. List
 * filtering uses weclapp's `field-operator=value` query convention (e.g. `company-like`); the
 * exact filter/pagination parameter names are inferred from weclapp's SDKs and community
 * integrations, not independently confirmed against a live tenant's Swagger UI this session —
 * verify before enabling for real customers, same caveat tier as Clockify's report endpoint.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface WeclappCredentials {
  tenant: string;
  apiToken: string;
}

// weclapp tenants are a plain DNS subdomain label — validated up front so a malformed value
// (e.g. a pasted full URL containing '#', '/', or '@') can't shift the actual request host out
// from under `AuthenticationToken`, which would otherwise send the token — and any customer/
// invoice data an agent submits — to whatever host precedes the special character instead of
// weclapp. Same class of bug fixed for Pipedrive's companyDomain.
const VALID_TENANT = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export class WeclappConnector implements Connector {
  constructor(private creds: WeclappCredentials) {
    if (!VALID_TENANT.test(creds.tenant)) {
      throw new Error("weclapp tenant must be just the subdomain label (e.g. 'mycompany' from mycompany.weclapp.com) — no scheme, slashes, or dots.");
    }
  }

  private get base(): string {
    return `https://${this.creds.tenant}.weclapp.com/webapp/api/v1`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { ...init.headers, AuthenticationToken: this.creds.apiToken, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { title?: string; message?: string })?.title ?? (body as { message?: string })?.message ?? `weclapp HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/party?pageSize=1");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "invoices", tools: ["invoices.search", "invoices.get", "invoices.create"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "contacts.search": {
        const email = input.email ? String(input.email) : "";
        const name = input.name ? String(input.name) : "";
        const params = new URLSearchParams();
        if (email) params.set("email-eq", email);
        else if (name) params.set("company-like", `%${name}%`);
        params.set("page", String(input.page ?? 1));
        params.set("pageSize", "25");
        const data = await this.request(`/party?${params.toString()}`);
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/party/id/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // NOTE (added on audit): weclapp's /party resource has confirmed `customer`/`supplier`
      // boolean flags (e.g. `GET /party?supplier-eq=true` is a documented filter), but this Hub's
      // shared contacts.create schema (tools/bookkeeping.ts, used identically by Lexoffice/
      // sevDesk/weclapp) has no field to say "create this as a vendor" — every contact created
      // through the Hub is tagged customer-only in weclapp. Fixing this properly means adding a
      // discriminator to the shared canonical schema (affecting every bookkeeping platform, not
      // just this connector) — out of scope for a per-connector fix; flagging here so it isn't a
      // silent surprise.
      case "contacts.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const body: Record<string, unknown> = { partyType: "ORGANIZATION", company: name, customer: true };
        if (input.email) body.email = String(input.email);
        const data = await this.request("/party", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      // `search`/`status` are declared on the canonical schema but weclapp's salesInvoice filter
      // field names for them (an invoiceNumber-like text match, and whatever enum/field backs
      // status) couldn't be confirmed against a live tenant this session — thrown clearly instead
      // of guessing a field name that could silently filter wrong or be rejected by the API.
      case "invoices.search": {
        if (input.search || input.status) {
          throw new Error("weclapp invoices.search does not yet support filtering by search/status — omit them (only page is supported) until this connector's filter field names are confirmed against a live tenant.");
        }
        const params = new URLSearchParams();
        params.set("page", String(input.page ?? 1));
        params.set("pageSize", "25");
        const data = await this.request(`/salesInvoice?${params.toString()}`);
        return { data };
      }
      case "invoices.get": {
        const invoiceId = String(input.invoice_id ?? "");
        if (!invoiceId) throw new Error("invoice_id is required.");
        const data = await this.request(`/salesInvoice/id/${encodeURIComponent(invoiceId)}`);
        return { data };
      }
      // POST /salesInvoice's line-item field names (salesInvoiceItems, unitPrice, vatPercentage)
      // are the least confirmed part of this connector -- inferred from weclapp's own "line items
      // with article/quantity/price/tax" convention used consistently across its order/invoice
      // resources, not spec-verified against a live tenant.
      case "invoices.create": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const lineItems = Array.isArray(input.line_items) ? input.line_items : [];
        if (lineItems.length === 0) throw new Error("line_items is required.");
        const body = {
          customerId: contactId,
          title: input.title ? String(input.title) : undefined,
          salesInvoiceItems: lineItems.map((item: Record<string, unknown>) => ({
            title: String(item.name ?? ""),
            quantity: Number(item.quantity ?? 1),
            unitPrice: Number(item.unit_price ?? 0),
            vatPercentage: Number(item.tax_rate ?? 19),
          })),
        };
        const data = await this.request("/salesInvoice", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      default:
        throw new Error(`weclapp connector does not support tool '${tool}'.`);
    }
  }
}
