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

  private async request(path: string): Promise<unknown> {
    const res = await fetch(`https://my.sevdesk.de/api/v1${path}`, {
      headers: { Authorization: this.creds.apiKey, Accept: "application/json" },
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
      { domain: "invoices", tools: ["invoices.search", "invoices.get"] },
      { domain: "contacts", tools: ["contacts.search"] },
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
      default:
        throw new Error(`sevDesk connector does not support tool '${tool}'.`);
    }
  }
}
