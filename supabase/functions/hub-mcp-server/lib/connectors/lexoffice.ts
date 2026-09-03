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

  private async request(path: string): Promise<unknown> {
    const res = await fetch(`https://api.lexware.io/v1${path}`, {
      headers: { Authorization: `Bearer ${this.creds.apiKey}`, Accept: "application/json" },
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
      { domain: "invoices", tools: ["invoices.search", "invoices.get"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
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
      default:
        throw new Error(`Lexoffice connector does not support tool '${tool}'.`);
    }
  }
}
