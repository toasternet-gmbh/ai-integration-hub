/**
 * sevDesk connector — bookkeeping. Single API token, sent as a raw `Authorization` header value
 * (sevDesk's convention — no "Bearer" prefix, unlike Lexoffice). Docs: api.sevdesk.de.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface SevdeskCredentials {
  apiKey: string;
}

interface SevdeskListResponse<T> {
  objects: T[];
}

export class SevdeskConnector implements Connector {
  constructor(private creds: SevdeskCredentials) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`https://my.sevdesk.de/api/v1${path}`, {
      ...init,
      headers: { Authorization: this.creds.apiKey, Accept: "application/json", ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: { message?: string } })?.error?.message ?? `sevDesk HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      // /Contact?limit=1 needs only a valid token and has no side effects — cheapest probe.
      await this.request("/Contact?limit=1");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "invoices", tools: ["invoices.search", "invoices.get", "invoices.create"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "reports", tools: ["reports.profit_and_loss"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "invoices.search": {
        // sevDesk's /Invoice list has no free-text search param — "search" narrows client-side by
        // invoice number, same posture as Lexoffice's voucherlist.
        const params = new URLSearchParams({ limit: "100" });
        if (input.status) params.set("status", String(input.status));
        const data = (await this.request(`/Invoice?${params.toString()}`)) as SevdeskListResponse<Record<string, unknown>>;
        const search = input.search ? String(input.search).toLowerCase() : "";
        const objects = search
          ? data.objects.filter((v) => String(v.invoiceNumber ?? "").toLowerCase().includes(search))
          : data.objects;
        return { data: { objects } };
      }
      case "invoices.get": {
        const invoiceId = String(input.invoice_id ?? "");
        if (!invoiceId) throw new Error("invoice_id is required.");
        const data = await this.request(`/Invoice/${encodeURIComponent(invoiceId)}`);
        return { data };
      }
      case "contacts.search": {
        const data = (await this.request("/Contact?limit=100")) as SevdeskListResponse<Record<string, unknown>>;
        const name = input.name ? String(input.name).toLowerCase() : "";
        const objects = name
          ? data.objects.filter((c) => String(c.name ?? "").toLowerCase().includes(name) || String(c.surename ?? "").toLowerCase().includes(name))
          : data.objects;
        return { data: { objects } };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/Contact/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // Best-effort — POST /Contact is a real, confirmed endpoint (api.sevdesk.de), but the exact
      // body shape is inferred, not confirmed against a live account. `category.id: 3` is sevDesk's
      // well-known fixed system category for "Kunde" (customer) — the other stable ids are
      // 2=Lieferant/vendor, 4=Partner, 28=Interessent/prospect, none of which this tool exposes yet.
      // sevDesk associates an email address via a separate CommunicationWay resource, not a Contact
      // field, so `email` isn't wired up here — the contact is created without one.
      case "contacts.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const body = { name, category: { id: 3, objectName: "Category" } };
        const data = await this.request("/Contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // Best-effort — POST /Invoice/Factory/saveInvoice is a real, confirmed endpoint, but this
      // exact invoice/invoicePosSave body shape is inferred, not confirmed against a live account.
      case "invoices.create": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const lineItemsInput = Array.isArray(input.line_items) ? (input.line_items as Array<Record<string, unknown>>) : [];
        if (lineItemsInput.length === 0) throw new Error("line_items is required.");
        const body = {
          invoice: {
            objectName: "Invoice", mapAll: true,
            contact: { id: contactId, objectName: "Contact" },
            invoiceDate: new Date().toISOString(),
            status: 100, // 100 = draft, sevDesk's status enum
            invoiceType: "RE",
            currency: "EUR",
            ...(input.title ? { header: String(input.title) } : {}),
          },
          invoicePosSave: lineItemsInput.map((li) => ({
            objectName: "InvoicePos", mapAll: true,
            quantity: Number(li.quantity ?? 1),
            price: Number(li.unit_price ?? 0),
            name: String(li.name ?? ""),
            taxRate: Number(li.tax_rate ?? 19),
          })),
          invoicePosDelete: null,
          takeDefaultAddress: true,
        };
        const data = await this.request("/Invoice/Factory/saveInvoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // GET /Report/profitAndLoss is a real, confirmed endpoint (sevDesk's dedicated Report
      // resource) — the exact query param names (startDate/endDate) are best-effort, not confirmed
      // against a live account.
      case "reports.profit_and_loss": {
        const params = new URLSearchParams({
          startDate: String(input.start_date ?? ""),
          endDate: String(input.end_date ?? ""),
        });
        const data = await this.request(`/Report/profitAndLoss?${params.toString()}`);
        return { data };
      }
      default:
        throw new Error(`sevDesk connector does not support tool '${tool}'.`);
    }
  }
}
