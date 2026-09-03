/**
 * sevDesk connector — bookkeeping. Single API token, sent as a raw `Authorization` header value
 * (sevDesk's convention — no "Bearer" prefix, unlike Lexoffice). Docs: api.sevdesk.de.
 *
 * `reports.profit_and_loss` (GET /Report/profitAndLoss) was removed 2026-09-03: cross-checked
 * against sevDesk's own official OpenAPI spec (api.sevdesk.de/openapi.yaml, fetched and grepped in
 * full) and that path simply does not exist — sevDesk's only `/Report/*` endpoints are CSV list
 * exports (invoicelist/orderlist/contactlist/voucherlist), and the Gewinn-und-Verlustrechnung
 * (P&L) is a web-UI-only feature with no documented API. The tool as shipped would have 404'd on
 * every real call. See 20260903000009_sevdesk_reports_pnl_bugfix.sql.
 *
 * quotes/order_confirmations/delivery_notes (search+get only, all backed by the unified /Order
 * resource) and credit_notes (search/get/create, backed by /CreditNote) were added 2026-09-03,
 * confirmed against the same OpenAPI spec. Deliberately read-only for the Order trio (and
 * createFromInvoice-only for credit notes): standalone creation of any of these requires
 * `addressCountry`/`contactPerson` references (StaticCountry/SevUser) that the spec has no
 * listable endpoint for -- no safe way to resolve a real id without guessing.
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
      { domain: "invoices", tools: ["invoices.search", "invoices.get", "invoices.create", "invoices.finalize", "invoices.record_payment", "invoices.void"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create", "contacts.update"] },
      { domain: "products", tools: ["products.create", "products.update"] },
      { domain: "vouchers", tools: ["vouchers.create_from_file"] },
      { domain: "quotes", tools: ["quotes.search", "quotes.get"] },
      { domain: "order_confirmations", tools: ["order_confirmations.search", "order_confirmations.get"] },
      { domain: "delivery_notes", tools: ["delivery_notes.search", "delivery_notes.get"] },
      { domain: "credit_notes", tools: ["credit_notes.search", "credit_notes.get", "credit_notes.create"] },
    ];
  }

  /** Shared by quotes/order_confirmations/delivery_notes — sevDesk unifies all three into one
   *  /Order resource distinguished by `orderType` (AN=Angebot/quote, AB=Auftrag/order
   *  confirmation, LI=Lieferschein/delivery note — confirmed in the OpenAPI spec's Model_Order).
   *  `orderType` is a real, documented GET filter (spec's Order-filter list, not shown in the
   *  formal `parameters` array but present in the endpoint's own description). No free-text search
   *  param exists, so "search" narrows client-side by order number/header, same posture as
   *  invoices.search. Deliberately read-only — see execute()'s default case comment for why create
   *  isn't implemented for this trio. */
  private async searchOrders(orderType: "AN" | "AB" | "LI", input: Record<string, unknown>): Promise<unknown> {
    const params = new URLSearchParams({ orderType, limit: "100" });
    const data = (await this.request(`/Order?${params.toString()}`)) as SevdeskListResponse<Record<string, unknown>>;
    const search = input.search ? String(input.search).toLowerCase() : "";
    const objects = search
      ? data.objects.filter((o) => String(o.orderNumber ?? "").toLowerCase().includes(search) || String(o.header ?? "").toLowerCase().includes(search))
      : data.objects;
    return { objects };
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
      // Best-effort — POST /Part is a real, confirmed endpoint (api.sevdesk.de), but the exact body
      // shape (beyond name/partNumber/stock/unity/taxRate) is inferred, not confirmed against a
      // live account. `unity.id: 1` is sevDesk's fixed system unit for "Stück" (piece).
      case "products.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const body = {
          name,
          stock: 0,
          unity: { id: 1, objectName: "Unity" },
          taxRate: Number(input.tax_rate ?? 19),
          price: Number(input.price ?? 0),
          ...(input.sku ? { partNumber: String(input.sku) } : {}),
        };
        const data = await this.request("/Part", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // PUT /Invoice/{id}/sendBy is real, confirmed against sevDesk's own OpenAPI spec
      // (api.sevdesk.de/openapi.yaml) -- `sendType` is required by that spec; VPR ("printed") is
      // used as the default since it marks the invoice sent/finalized without actually emailing
      // the customer, the least surprising default for an agent-triggered action.
      // `sendDraft: false` is what actually assigns the real invoice number -- true would create an
      // internal-use draft PDF without changing status, which defeats the point of this tool.
      case "invoices.finalize": {
        const invoiceId = String(input.invoice_id ?? "");
        if (!invoiceId) throw new Error("invoice_id is required.");
        const allowedSendTypes = new Set(["VPR", "VP", "VM", "VPDF"]);
        const sendType = input.send_type && allowedSendTypes.has(String(input.send_type)) ? String(input.send_type) : "VPR";
        const data = await this.request(`/Invoice/${encodeURIComponent(invoiceId)}/sendBy`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sendType, sendDraft: false }),
        });
        return { data };
      }
      // PUT /Invoice/{id}/bookAmount is real, confirmed against the OpenAPI spec. `type:
      // FULL_PAYMENT` is sevDesk's normal-booking enum value; `date` is documented as an integer
      // (epoch seconds), not an ISO string, unlike every date field elsewhere in this connector.
      case "invoices.record_payment": {
        const invoiceId = String(input.invoice_id ?? "");
        const checkAccountId = String(input.check_account_id ?? "");
        if (!invoiceId) throw new Error("invoice_id is required.");
        if (!checkAccountId) throw new Error("check_account_id is required.");
        if (input.amount == null) throw new Error("amount is required.");
        const dateEpoch = Math.floor((input.date ? Date.parse(String(input.date)) : Date.now()) / 1000);
        const body = {
          amount: Number(input.amount),
          date: dateEpoch,
          type: "FULL_PAYMENT",
          checkAccount: { id: checkAccountId, objectName: "CheckAccount" },
        };
        const data = await this.request(`/Invoice/${encodeURIComponent(invoiceId)}/bookAmount`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // POST /Invoice/{id}/cancelInvoice is real, confirmed against the OpenAPI spec -- no request
      // body. sevDesk creates and auto-pays a reversing cancellation invoice and flips the source
      // invoice's status to "cancelled".
      case "invoices.void": {
        const invoiceId = String(input.invoice_id ?? "");
        if (!invoiceId) throw new Error("invoice_id is required.");
        const data = await this.request(`/Invoice/${encodeURIComponent(invoiceId)}/cancelInvoice`, { method: "POST" });
        return { data };
      }
      // PUT /Contact/{id} is real, confirmed against the OpenAPI spec. Same email limitation as
      // contacts.create -- sevDesk associates email via a separate CommunicationWay resource, not
      // a Contact field, so an `email` input is silently not applied here (matching create's
      // documented behavior) rather than erroring on a field this resource has no place for.
      case "contacts.update": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const body: Record<string, unknown> = {};
        if (input.name != null) body.name = String(input.name);
        const data = await this.request(`/Contact/${encodeURIComponent(contactId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // PUT /Part/{id} is real, confirmed against the OpenAPI spec -- same field set products.create
      // already writes.
      case "products.update": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const body: Record<string, unknown> = {};
        if (input.name != null) body.name = String(input.name);
        if (input.price != null) body.price = Number(input.price);
        if (input.tax_rate != null) body.taxRate = Number(input.tax_rate);
        if (input.sku != null) body.partNumber = String(input.sku);
        const data = await this.request(`/Part/${encodeURIComponent(productId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      // Two real, confirmed endpoints (api.sevdesk.de): upload the file to get a temp document
      // reference, then create the voucher record pointing at it. Best-effort on the exact
      // saveVoucher body shape beyond the fields multiple independent sources agree on
      // (voucherType/description/status/supplier/voucherDate/taxType/creditDebit +
      // voucherPosSave[].{accountingType,taxRate,sum}) — not confirmed against a live account, and
      // in particular how the uploaded file's reference is threaded into that body is inferred, not
      // documented anywhere this session could reach.
      case "vouchers.create_from_file": {
        const fileBase64 = String(input.file_base64 ?? "");
        const fileName = String(input.file_name ?? "");
        if (!fileBase64 || !fileName) throw new Error("file_base64 and file_name are required.");
        const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
        const form = new FormData();
        form.set("file", new Blob([bytes], { type: String(input.mime_type ?? "image/jpeg") }), fileName);
        const uploaded = (await this.request("/Voucher/Factory/uploadTempFile", { method: "POST", body: form })) as {
          objects?: { filename?: string };
        };
        const body = {
          voucher: {
            objectName: "Voucher", mapAll: true,
            voucherType: "VOU",
            creditDebit: "C",
            status: 50, // 50 = draft, sevDesk's status enum
            taxType: "default",
            voucherDate: new Date().toISOString(),
            description: input.description ? String(input.description) : fileName,
          },
          voucherPosSave: [],
          voucherPosDelete: null,
          filename: uploaded.objects?.filename,
        };
        const data = await this.request("/Voucher/Factory/saveVoucher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { data };
      }
      case "quotes.search": {
        const data = await this.searchOrders("AN", input);
        return { data };
      }
      case "quotes.get": {
        const id = String(input.quote_id ?? "");
        if (!id) throw new Error("quote_id is required.");
        const data = await this.request(`/Order/${encodeURIComponent(id)}`);
        return { data };
      }
      case "order_confirmations.search": {
        const data = await this.searchOrders("AB", input);
        return { data };
      }
      case "order_confirmations.get": {
        const id = String(input.order_confirmation_id ?? "");
        if (!id) throw new Error("order_confirmation_id is required.");
        const data = await this.request(`/Order/${encodeURIComponent(id)}`);
        return { data };
      }
      case "delivery_notes.search": {
        const data = await this.searchOrders("LI", input);
        return { data };
      }
      case "delivery_notes.get": {
        const id = String(input.delivery_note_id ?? "");
        if (!id) throw new Error("delivery_note_id is required.");
        const data = await this.request(`/Order/${encodeURIComponent(id)}`);
        return { data };
      }
      case "credit_notes.search": {
        const params = new URLSearchParams({ limit: "100" });
        const data = (await this.request(`/CreditNote?${params.toString()}`)) as SevdeskListResponse<Record<string, unknown>>;
        const search = input.search ? String(input.search).toLowerCase() : "";
        const objects = search
          ? data.objects.filter((c) => String(c.creditNoteNumber ?? "").toLowerCase().includes(search))
          : data.objects;
        return { data: { objects } };
      }
      case "credit_notes.get": {
        const id = String(input.credit_note_id ?? "");
        if (!id) throw new Error("credit_note_id is required.");
        const data = await this.request(`/CreditNote/${encodeURIComponent(id)}`);
        return { data };
      }
      // POST /CreditNote/Factory/createFromInvoice is real, confirmed, and simple ({invoice: {id,
      // objectName}}) -- this is the ONLY credit_notes.create path implemented for sevDesk.
      // Standalone credit note creation (sevDesk's saveCreditNote, and likewise Order/Factory/
      // saveOrder for quotes/order_confirmations/delivery_notes above) requires addressCountry
      // (a StaticCountry reference) and contactPerson (a SevUser reference) as hard-required
      // fields, and the OpenAPI spec has no listable endpoint for either resource -- there's no
      // safe way to resolve a real id for them without guessing, so standalone creation for all
      // four of these document types is deliberately not implemented here. preceding_invoice_id
      // is therefore effectively required for sevDesk even though the canonical tool schema
      // doesn't enforce that (Lexoffice supports both paths).
      case "credit_notes.create": {
        const precedingInvoiceId = input.preceding_invoice_id ? String(input.preceding_invoice_id) : "";
        if (!precedingInvoiceId) throw new Error("preceding_invoice_id is required on sevDesk -- standalone credit notes aren't supported (see connector source comment).");
        const data = await this.request("/CreditNote/Factory/createFromInvoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice: { id: precedingInvoiceId, objectName: "Invoice" } }),
        });
        return { data };
      }
      default:
        throw new Error(`sevDesk connector does not support tool '${tool}'.`);
    }
  }
}
