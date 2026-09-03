/**
 * Lexoffice (Lexware Office) connector — bookkeeping. Single bearer API key, no OAuth.
 * API gateway moved from api.lexoffice.io to api.lexware.io on 2025-05-26; the legacy host is
 * being retired, so new integrations point at the new one. Docs: developers.lexware.io.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface LexofficeCredentials {
  apiKey: string;
}

export class LexofficeConnector implements Connector {
  constructor(private creds: LexofficeCredentials) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`https://api.lexware.io/v1${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.creds.apiKey}`, Accept: "application/json", ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `Lexoffice HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      // /countries needs only a valid API key and has no side effects — cheapest possible probe.
      await this.request("/countries");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "invoices", tools: ["invoices.search", "invoices.get", "invoices.create"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "invoices.search": {
        // voucherlist has no free-text search param — it filters by voucherStatus/archived/etc.
        // and paginates; "search" narrows client-side by invoice/contact name in the returned page.
        const params = new URLSearchParams({ voucherType: "invoice" });
        if (input.status) params.set("voucherStatus", String(input.status));
        params.set("page", String(input.page ?? 0));
        const data = (await this.request(`/voucherlist?${params.toString()}`)) as { content?: Array<Record<string, unknown>> };
        const search = input.search ? String(input.search).toLowerCase() : "";
        const content = search
          ? (data.content ?? []).filter((v) => String(v.contactName ?? "").toLowerCase().includes(search) || String(v.voucherNumber ?? "").toLowerCase().includes(search))
          : data.content;
        return { data: { ...data, content } };
      }
      case "invoices.get": {
        const invoiceId = String(input.invoice_id ?? "");
        if (!invoiceId) throw new Error("invoice_id is required.");
        const data = await this.request(`/invoices/${encodeURIComponent(invoiceId)}`);
        return { data };
      }
      case "contacts.search": {
        const params = new URLSearchParams();
        if (input.name) params.set("name", String(input.name));
        if (input.email) params.set("email", String(input.email));
        params.set("page", String(input.page ?? 0));
        const data = await this.request(`/contacts?${params.toString()}`);
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/contacts/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // Best-effort — POST /v1/contacts is a real, confirmed endpoint (developers.lexware.io),
      // but this exact body shape (roles/company/emailAddresses nesting) is inferred from general
      // Lexware Office API knowledge, not confirmed against a live account. Verify before relying
      // on it for real customers.
      case "contacts.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const body: Record<string, unknown> = { roles: { customer: {} }, company: { name } };
        if (input.email) body.emailAddresses = { business: [String(input.email)] };
        const data = await this.request("/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // Best-effort — POST /v1/invoices is a real, confirmed endpoint, but this exact lineItems/
      // taxConditions body shape is inferred, not confirmed against a live account. finalize=false
      // creates a draft rather than a legally-finalized, numbered invoice, deliberately the more
      // conservative default for an untested write path.
      case "invoices.create": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const lineItemsInput = Array.isArray(input.line_items) ? (input.line_items as Array<Record<string, unknown>>) : [];
        if (lineItemsInput.length === 0) throw new Error("line_items is required.");
        const lineItems = lineItemsInput.map((li) => ({
          type: "custom",
          name: String(li.name ?? ""),
          quantity: Number(li.quantity ?? 1),
          unitName: "Stück",
          unitPrice: { currency: "EUR", netAmount: Number(li.unit_price ?? 0), taxRatePercentage: Number(li.tax_rate ?? 19) },
        }));
        const body = {
          voucherDate: new Date().toISOString(),
          address: { contactId },
          lineItems,
          totalPrice: { currency: "EUR" },
          taxConditions: { taxType: "net" },
          ...(input.title ? { title: String(input.title) } : {}),
        };
        const data = await this.request("/invoices?finalize=false", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      default:
        throw new Error(`Lexoffice connector does not support tool '${tool}'.`);
    }
  }
}
