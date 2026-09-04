/**
 * Billwerk+ connector — bookkeeping (subscription billing). Billwerk+ rebranded to "Frisbii
 * Billing & Pay" (docs.frisbii.com) — this connector targets Frisbii's current live REST API, not
 * the older, separate "Billwerk+ Optimize" product (docu.billwerk.plus), which uses a different
 * OAuth2 client-credentials auth model entirely. Frisbii instead uses a single private API key
 * over HTTP Basic auth: `Authorization: Basic base64("{privateKey}:")` (docs.frisbii.com/
 * reference/authentication). Base: `https://api.frisbii.com/v1` (the pre-rebrand
 * `https://api.reepay.com/v1` host also still works per Frisbii's own domain-migration notes).
 *
 * Frisbii is a subscription-billing platform, not a general bookkeeping system — it has no
 * generic "create an invoice from line items" endpoint the way Lexoffice/sevDesk do. The closest
 * equivalent is `POST /charge` (an on-demand, non-subscription charge) with `settle: true`, which
 * both charges and immediately produces an invoice — this is what `invoices.create` maps onto.
 * The exact `order_lines` field names (`ordertext`/`quantity`/`amount`/`vat`) are inferred from
 * Reepay/Frisbii's documented charge-line conventions, not independently spec-verified this
 * session — verify against a live sandbox account before enabling for real customers.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const BASE = "https://api.frisbii.com/v1";

export interface BillwerkCredentials {
  privateKey: string;
}

export class BillwerkConnector implements Connector {
  constructor(private creds: BillwerkCredentials) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const auth = btoa(`${this.creds.privateKey}:`);
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: string; message?: string })?.error ?? (body as { message?: string })?.message ?? `Frisbii/Billwerk+ HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/list/customer?size=1");
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
        const data = await this.request("/list/customer?size=25");
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/customer/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // Frisbii customers are keyed by a caller-chosen `handle`, not a server-assigned id --
      // there's no canonical "contact handle" input on this Hub's contacts.create, so one is
      // derived from the name (slugified) plus a short random suffix to avoid collisions.
      case "contacts.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const handle = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`;
        const body: Record<string, unknown> = { handle, company: name };
        if (input.email) body.email = String(input.email);
        const data = await this.request("/customer", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "invoices.search": {
        const data = await this.request("/list/invoice?size=25");
        return { data };
      }
      case "invoices.get": {
        const invoiceId = String(input.invoice_id ?? "");
        if (!invoiceId) throw new Error("invoice_id is required.");
        const data = await this.request(`/invoice/${encodeURIComponent(invoiceId)}`);
        return { data };
      }
      case "invoices.create": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const lineItems = Array.isArray(input.line_items) ? input.line_items : [];
        if (lineItems.length === 0) throw new Error("line_items is required.");
        const handle = `charge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const body = {
          handle,
          customer_handle: contactId,
          settle: true,
          ordertext: input.title ? String(input.title) : undefined,
          order_lines: lineItems.map((item: Record<string, unknown>) => ({
            ordertext: String(item.name ?? ""),
            quantity: Number(item.quantity ?? 1),
            amount: Math.round(Number(item.unit_price ?? 0) * 100),
            vat: Number(item.tax_rate ?? 19) / 100,
          })),
        };
        const data = await this.request("/charge", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      default:
        throw new Error(`Billwerk+/Frisbii connector does not support tool '${tool}'.`);
    }
  }
}
