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
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create", "contacts.update"] },
      { domain: "products", tools: ["products.create", "products.update"] },
      { domain: "vouchers", tools: ["vouchers.create_from_file"] },
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
      // Best-effort — PUT /v1/contacts/{id} is a real, confirmed endpoint. Lexware Office resources
      // use optimistic locking (a `version` field that must match the server's current value), so
      // the existing contact is fetched first and merged rather than sending a bare partial body.
      case "contacts.update": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const existing = (await this.request(`/contacts/${encodeURIComponent(contactId)}`)) as Record<string, unknown>;
        const company = (existing.company as Record<string, unknown>) ?? {};
        if (input.name != null) company.name = String(input.name);
        const body: Record<string, unknown> = { ...existing, company };
        if (input.email != null) body.emailAddresses = { business: [String(input.email)] };
        const data = await this.request(`/contacts/${encodeURIComponent(contactId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // Best-effort — PUT /v1/articles/{id} is a real, confirmed endpoint, same optimistic-locking
      // posture as contacts.update above.
      case "products.update": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const existing = (await this.request(`/articles/${encodeURIComponent(productId)}`)) as Record<string, unknown>;
        const price = (existing.price as Record<string, unknown>) ?? {};
        if (input.price != null) price.netPrice = Number(input.price);
        if (input.tax_rate != null) price.taxRate = Number(input.tax_rate);
        const body: Record<string, unknown> = { ...existing, price };
        if (input.name != null) body.title = String(input.name);
        if (input.sku != null) body.articleNumber = String(input.sku);
        const data = await this.request(`/articles/${encodeURIComponent(productId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // Best-effort — POST /v1/files (multipart, field "file" + "type"="voucher") is a real,
      // confirmed endpoint, and the returned file id is referenced from POST /v1/vouchers'
      // `files` array to attach the receipt/image to an expense record (type "purchaseinvoice").
      // This is more uncertain than sevDesk's equivalent flow: the exact shape of the `files` array
      // entry (a bare id string vs. an object) could not be pinned down to spec-level confidence
      // from Lexware's docs, only corroborated third-party integration writeups -- verify against
      // a live account before relying on it. `voucherStatus: "unchecked"` is Lexware's own
      // "not yet booked" state, the only one where most other fields become optional, matching the
      // conservative "draft first" posture used elsewhere in this connector.
      case "vouchers.create_from_file": {
        const fileBase64 = String(input.file_base64 ?? "");
        const fileName = String(input.file_name ?? "");
        if (!fileBase64 || !fileName) throw new Error("file_base64 and file_name are required.");
        const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
        const form = new FormData();
        form.set("file", new Blob([bytes], { type: String(input.mime_type ?? "image/jpeg") }), fileName);
        form.set("type", "voucher");
        const uploaded = (await this.request("/files", { method: "POST", body: form })) as { id?: string };
        if (!uploaded.id) throw new Error("Lexoffice did not return a file id for the uploaded voucher.");
        const body = {
          type: "purchaseinvoice",
          voucherStatus: "unchecked",
          voucherDate: new Date().toISOString(),
          remark: input.description ? String(input.description) : fileName,
          files: [uploaded.id],
        };
        const data = await this.request("/vouchers", {
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
      // POST /v1/articles is a real, confirmed endpoint (developers.lexware.io) with a confirmed
      // required-field list (title, type, unitName, price.{netPrice|grossPrice, leadingPrice,
      // taxRate}) — this is a billable article/item for invoicing, not a storefront product.
      case "products.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const body = {
          title: name,
          type: "PRODUCT",
          unitName: "Stück",
          price: { netPrice: Number(input.price ?? 0), leadingPrice: "NET", taxRate: Number(input.tax_rate ?? 19) },
          ...(input.sku ? { articleNumber: String(input.sku) } : {}),
        };
        const data = await this.request("/articles", {
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
