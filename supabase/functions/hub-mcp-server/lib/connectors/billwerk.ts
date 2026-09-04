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

  private authHeader(): string {
    try {
      return btoa(`${this.creds.privateKey}:`);
    } catch {
      // btoa throws for any character outside Latin1 (e.g. a smart quote pasted from a docs
      // page) — surfaced here as one clear validation error instead of a cryptic native
      // InvalidCharacterError bubbling out of whichever tool call happened to run first.
      throw new Error("Billwerk+/Frisbii privateKey contains a character that can't be used in an HTTP Basic auth header — re-check it was copied correctly (no smart quotes or other non-ASCII characters).");
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const auth = this.authHeader();
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      // Live-tested 2026-09-04: a real Frisbii error body looks like {"error": "Invalid request",
      // "message": "Not a valid private key", ...} -- `error` is a generic category label,
      // `message` carries the actually useful detail, so `message` is checked first.
      const message = (body as { message?: string; error?: string })?.message ?? (body as { error?: string })?.error ?? `Frisbii/Billwerk+ HTTP ${res.status}`;
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
      // `name`/`email` are declared on the canonical schema but Frisbii's /list/customer endpoint
      // has no confirmed filter query params — thrown clearly instead of silently returning an
      // unfiltered list that looks like (but isn't) a real match.
      case "contacts.search": {
        if (input.name || input.email) {
          throw new Error("Billwerk+/Frisbii contacts.search does not yet support filtering by name/email — omit them until a filter parameter is confirmed against the real API.");
        }
        const data = await this.request("/list/customer?size=25");
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/customer/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // Frisbii customers are keyed by a caller-chosen `handle`, not a server-assigned id -- there's
      // no canonical "contact handle" input on this Hub's contacts.create, so one is derived from
      // the name (slugified). Uses crypto.randomUUID() (same pattern as matrix.ts's send txnId)
      // rather than Math.random() for the uniqueness suffix -- a weak random suffix risked
      // colliding with another handle and merging into (or erroring against) an unrelated existing
      // customer. A fixed `contact-` prefix guarantees the handle starts alphanumeric even when
      // `name` has no ASCII letters/digits at all (e.g. CJK/Cyrillic/Arabic), which previously
      // produced a malformed leading-hyphen handle Frisbii would likely reject.
      case "contacts.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
        const handle = `contact-${slug ? `${slug}-` : ""}${crypto.randomUUID()}`;
        const body: Record<string, unknown> = { handle, company: name };
        if (input.email) body.email = String(input.email);
        const data = await this.request("/customer", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      // `search`/`status`/`page` are declared on the canonical schema but Frisbii's /list/invoice
      // endpoint has no confirmed filter/pagination query params — thrown clearly rather than
      // silently always returning an unfiltered first page.
      case "invoices.search": {
        if (input.search || input.status || (input.page != null && Number(input.page) > 1)) {
          throw new Error("Billwerk+/Frisbii invoices.search does not yet support filtering by search/status or paging beyond the first page — omit them until confirmed against the real API.");
        }
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
        const handle = `charge-${crypto.randomUUID()}`;
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
