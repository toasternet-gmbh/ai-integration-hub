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

export class WeclappConnector implements Connector {
  constructor(private creds: WeclappCredentials) {}

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
      case "contacts.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const body: Record<string, unknown> = { partyType: "ORGANIZATION", company: name, customer: true };
        if (input.email) body.email = String(input.email);
        const data = await this.request("/party", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "invoices.search": {
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
