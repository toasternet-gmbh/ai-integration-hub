/**
 * PrestaShop connector — e-commerce, via the store's Webservice API (must be enabled per-store
 * under Advanced Parameters → Webservice). Auth is HTTP Basic with the webservice key as username
 * and an empty password. Reads use `output_format`/`io_format=JSON` (both sent to cover either
 * PrestaShop version). Docs: devdocs.prestashop-project.org/8/webservice/.
 *
 * Base URL/auth/endpoint shape all come from PrestaShop's own official, stable devdocs (not
 * guessed the way JTL's host was). Round-tripped 2026-08-27 against a real, live local PrestaShop
 * 8 store (Docker `prestashop/prestashop:8-apache` + MySQL, unattended install, Webservice API
 * genuinely enabled via `ps_configuration`/`ps_webservice_account`/`ps_webservice_account_shop`
 * rows and a real generated webservice key) — orders.search/orders.get/products.search/
 * products.get all returned real demo order/product data through the Hub end-to-end, not mocked.
 * One gotcha found during that verification: PrestaShop 302-redirects `/api/...` requests whose
 * Host header doesn't match the shop's configured `ps_shop_url` domain, so the connector's
 * `storeUrl` credential must resolve to the exact host PrestaShop's shop domain is configured
 * with (or the redirect silently breaks the request) — this isn't PrestaShop-Docker-specific, it
 * applies to any store with multiple reachable hostnames.
 *
 * Write support (products.update_price, inventory.*, orders.cancel, orders.refund) was added and
 * round-tripped live 2026-09-03 against a second, fresh local PrestaShop 8 Docker store. The
 * webservice genuinely has NO JSON write support at all, in any version through 8.1 (confirmed via
 * PrestaShop's own devdocs update-resource tutorial and multiple long-open core GitHub issues) —
 * every write here fetches the existing XML representation, edits only the field(s) being changed,
 * strips the fields PrestaShop's API rejects as read-only computed values (confirmed by testing:
 * `manufacturer_name`, `quantity`, `type`, `position_in_category` on products; `shipping_number` on
 * orders) plus the whole `<associations>` block (relational data, not needed for these single-field
 * edits and a documented source of validation errors on complex resources like products), and PUTs
 * the result back as `text/xml`. This is more fragile than the JSON reads elsewhere in this
 * connector — a store with customizations to these resources could reject a field this connector
 * doesn't know to strip.
 *
 * products.create/products.update/products.categories.* were added and round-tripped live
 * 2026-09-03 against a third, fresh local PrestaShop 8 Docker store. Creating from the blank
 * product schema (`?schema=blank`) hits one more read-only-computed-field rejection beyond the
 * ones already known: `position_in_category` must be stripped on create too (PrestaShop rejects
 * the blank schema's empty value with "You cannot set 0 or a negative position, the minimum is
 * 1") — confirmed live, along with confirming `link_rewrite` (the URL slug) doesn't need to be
 * set explicitly; PrestaShop auto-derives it from the name.
 *
 * Still short of a real, fully-authorized customer store on any round — see README.md "Known
 * gaps" before enabling for real customers.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface PrestaShopCredentials {
  storeUrl: string;
  accessToken: string; // the webservice key
}

export class PrestaShopConnector implements Connector {
  constructor(private creds: PrestaShopCredentials) {}

  private baseUrl(): string {
    return `${this.creds.storeUrl.replace(/\/+$/, "")}/api`;
  }

  private authHeader(): string {
    return "Basic " + btoa(`${this.creds.accessToken}:`);
  }

  private async request(path: string, params: URLSearchParams = new URLSearchParams()): Promise<unknown> {
    params.set("output_format", "JSON");
    params.set("io_format", "JSON");
    const res = await fetch(`${this.baseUrl()}${path}?${params.toString()}`, {
      headers: { Authorization: this.authHeader(), Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `PrestaShop HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  /** Raw XML fetch/write for the resources that need it — PrestaShop's webservice cannot read or
   *  write JSON for anything but a GET. Returns the response body as text either way. */
  private async requestXml(path: string, init: RequestInit = {}): Promise<string> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: { Authorization: this.authHeader(), ...(init.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) {
      const message = /<message>(.*?)<\/message>/s.exec(text)?.[1] ?? `PrestaShop HTTP ${res.status}`;
      throw new Error(message);
    }
    return text;
  }

  /** Removes a top-level `<tag>...</tag>` block entirely — used for fields PrestaShop's webservice
   *  rejects as read-only/computed on PUT (see the connector's header comment) and for the
   *  `<associations>` block, which isn't needed for a single-field edit. */
  private stripXmlTag(xml: string, tag: string): string {
    return xml.replace(new RegExp(`\\s*<${tag}[^>]*>[\\s\\S]*?</${tag}>\\n?`), "");
  }

  /** Replaces one field's CDATA value in place, preserving any attributes on its opening tag. */
  private setXmlField(xml: string, tag: string, value: string): string {
    const re = new RegExp(`(<${tag}[^>]*>)(<!\\[CDATA\\[)[\\s\\S]*?(\\]\\]>)(</${tag}>)`);
    if (!re.test(xml)) throw new Error(`PrestaShop response has no <${tag}> field to update.`);
    return xml.replace(re, `$1$2${value}$3$4`);
  }

  /** Some fields (product `name`/`description`, etc.) are multi-language on PrestaShop, wrapped as
   *  `<tag><language id="X"><![CDATA[...]]></language>...</tag>` rather than a plain scalar CDATA
   *  — this sets every `<language>` entry inside the field to the same value rather than trying to
   *  target one specific language id. */
  private setXmlLocalizedField(xml: string, tag: string, value: string): string {
    const fieldRe = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
    const m = fieldRe.exec(xml);
    if (!m) throw new Error(`PrestaShop response has no <${tag}> field to update.`);
    const updatedInner = m[1].replace(/(<language[^>]*>)(<!\[CDATA\[)[\s\S]*?(\]\]>)(<\/language>)/g, `$1$2${value}$3$4`);
    return xml.replace(fieldRe, `<${tag}>${updatedInner}</${tag}>`);
  }

  private getXmlField(xml: string, tag: string): string | null {
    const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`).exec(xml);
    return m ? m[1] : null;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/orders", new URLSearchParams({ limit: "1" }));
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund", "orders.cancel"] },
      { domain: "products", tools: ["products.search", "products.get", "products.update_price", "products.create", "products.update"] },
      { domain: "products", tools: ["products.categories.search", "products.categories.get"] },
      { domain: "products", tools: ["products.images.search", "products.images.create"] },
      { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
      { domain: "contacts", tools: ["contacts.addresses.search", "contacts.addresses.create"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "orders.search": {
        const params = new URLSearchParams();
        params.set("limit", String(input.limit ?? 25));
        const data = await this.request("/orders", params);
        return { data };
      }
      case "orders.get": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const data = await this.request(`/orders/${encodeURIComponent(orderId)}`);
        return { data };
      }
      case "products.search": {
        const params = new URLSearchParams();
        params.set("limit", String(input.limit ?? 25));
        const data = await this.request("/products", params);
        return { data };
      }
      case "products.get": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.request(`/products/${encodeURIComponent(productId)}`);
        return { data };
      }
      case "contacts.search": {
        const params = new URLSearchParams({ limit: "25" });
        if (input.email) params.set("filter[email]", String(input.email));
        else if (input.name) params.set("filter[lastname]", `%${input.name}%`);
        const data = await this.request("/customers", params);
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/customers/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // Verified live: GET the product's full XML, strip the read-only computed fields PrestaShop
      // rejects on PUT (see header comment) plus <associations>, set <price>, PUT it back.
      case "products.update_price": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (input.price == null) throw new Error("price is required.");
        let xml = await this.requestXml(`/products/${encodeURIComponent(productId)}`);
        for (const tag of ["position_in_category", "manufacturer_name", "quantity", "type"]) xml = this.stripXmlTag(xml, tag);
        xml = this.stripXmlTag(xml, "associations");
        xml = this.setXmlField(xml, "price", String(input.price));
        await this.requestXml(`/products/${encodeURIComponent(productId)}`, { method: "PUT", headers: { "Content-Type": "text/xml" }, body: xml });
        return { data: { product_id: productId, price: Number(input.price) } };
      }
      // Verified live: GET the blank product schema, strip position_in_category (the one field
      // PrestaShop rejects as an empty/zero value on create -- "You cannot set 0 or a negative
      // position, the minimum is 1"), fill in name/price/reference, POST it. link_rewrite (the
      // URL slug) is left blank -- confirmed PrestaShop auto-derives it from the name.
      case "products.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        if (input.price == null) throw new Error("price is required.");
        let xml = await this.requestXml("/products?schema=blank");
        xml = this.stripXmlTag(xml, "position_in_category");
        xml = this.setXmlLocalizedField(xml, "name", name);
        xml = this.setXmlField(xml, "price", String(input.price));
        if (input.sku) xml = this.setXmlField(xml, "reference", String(input.sku));
        const response = await this.requestXml("/products", { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml });
        const productId = this.getXmlField(response, "id");
        return { data: { product_id: productId, name, price: Number(input.price) } };
      }
      case "products.update": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        let xml = await this.requestXml(`/products/${encodeURIComponent(productId)}`);
        for (const tag of ["position_in_category", "manufacturer_name", "quantity", "type"]) xml = this.stripXmlTag(xml, tag);
        xml = this.stripXmlTag(xml, "associations");
        if (input.name != null) xml = this.setXmlLocalizedField(xml, "name", String(input.name));
        if (input.price != null) xml = this.setXmlField(xml, "price", String(input.price));
        if (input.sku != null) xml = this.setXmlField(xml, "reference", String(input.sku));
        await this.requestXml(`/products/${encodeURIComponent(productId)}`, { method: "PUT", headers: { "Content-Type": "text/xml" }, body: xml });
        return { data: { product_id: productId } };
      }
      case "products.categories.search": {
        const params = new URLSearchParams({ limit: String(input.limit ?? 25) });
        if (input.search) params.set("filter[name]", `%${input.search}%`);
        const data = await this.request("/categories", params);
        return { data };
      }
      case "products.categories.get": {
        const categoryId = String(input.category_id ?? "");
        if (!categoryId) throw new Error("category_id is required.");
        const data = await this.request(`/categories/${encodeURIComponent(categoryId)}`);
        return { data };
      }
      // Best-effort, not live-verified this round (unlike the products/orders/stock writes
      // above): POST images/products/{id} is a real, documented endpoint that -- uniquely among
      // PrestaShop's writes -- takes a genuine multipart upload rather than XML. Field name "image"
      // matches PrestaShop's own devdocs example; not round-tripped against a live store.
      case "products.images.search": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.request(`/images/products/${encodeURIComponent(productId)}`);
        return { data };
      }
      case "products.images.create": {
        const productId = String(input.product_id ?? "");
        const fileBase64 = String(input.file_base64 ?? "");
        const fileName = String(input.file_name ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (!fileBase64 || !fileName) throw new Error("file_base64 and file_name are required.");
        const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
        const form = new FormData();
        form.set("image", new Blob([bytes], { type: String(input.mime_type ?? "image/jpeg") }), fileName);
        const res = await fetch(`${this.baseUrl()}/images/products/${encodeURIComponent(productId)}`, {
          method: "POST",
          headers: { Authorization: this.authHeader() },
          body: form,
        });
        const text = await res.text();
        if (!res.ok) throw new Error(/<message>(.*?)<\/message>/s.exec(text)?.[1] ?? `PrestaShop HTTP ${res.status}`);
        return { data: { product_id: productId } };
      }
      // Best-effort, not live-verified this round: GET/POST /addresses is a real, documented
      // resource. Create follows the same blank-schema pattern already verified live for
      // products.create -- fetch the blank XML, fill in the required fields, POST it.
      // CAVEAT: the shared contacts.addresses.create tool schema documents `country` as an ISO-2
      // code (matches Shopify/Magento), but PrestaShop's `id_country` field is that store's own
      // internal numeric country id (e.g. 21 = Germany on a default install), not an ISO code --
      // passed straight through here rather than translated, since there's no live-verified lookup
      // in this connector. Callers targeting PrestaShop need to pass that numeric id in `country`.
      case "contacts.addresses.search": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const params = new URLSearchParams({ "filter[id_customer]": contactId });
        const data = await this.request("/addresses", params);
        return { data };
      }
      case "contacts.addresses.create": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        if (!input.address1 || !input.city || !input.zip || !input.country) throw new Error("address1, city, zip, and country are required.");
        let xml = await this.requestXml("/addresses?schema=blank");
        xml = this.setXmlField(xml, "id_customer", contactId);
        xml = this.setXmlField(xml, "firstname", input.first_name ? String(input.first_name) : "N/A");
        xml = this.setXmlField(xml, "lastname", input.last_name ? String(input.last_name) : "N/A");
        xml = this.setXmlField(xml, "address1", String(input.address1));
        xml = this.setXmlField(xml, "city", String(input.city));
        xml = this.setXmlField(xml, "postcode", String(input.zip));
        xml = this.setXmlField(xml, "id_country", String(input.country));
        if (input.phone) xml = this.setXmlField(xml, "phone", String(input.phone));
        xml = this.setXmlField(xml, "alias", "Address");
        const response = await this.requestXml("/addresses", { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml });
        const addressId = this.getXmlField(response, "id");
        return { data: { address_id: addressId } };
      }
      // stock_availables is a plain, uncomplicated resource (verified live) — no field-stripping
      // needed the way products/orders need. A simple (non-combination) product's own stock lives
      // at id_product_attribute=0; a product with variants would need one call per combination,
      // not handled here yet.
      case "inventory.get_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const stockId = await this.findStockAvailableId(productId);
        const xml = await this.requestXml(`/stock_availables/${stockId}`);
        const quantity = this.getXmlField(xml, "quantity");
        return { data: { product_id: productId, quantity: quantity != null ? Number(quantity) : null } };
      }
      case "inventory.update_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (input.quantity == null) throw new Error("quantity is required.");
        const stockId = await this.findStockAvailableId(productId);
        let xml = await this.requestXml(`/stock_availables/${stockId}`);
        xml = this.setXmlField(xml, "quantity", String(Number(input.quantity)));
        await this.requestXml(`/stock_availables/${stockId}`, { method: "PUT", headers: { "Content-Type": "text/xml" }, body: xml });
        return { data: { product_id: productId, quantity: Number(input.quantity) } };
      }
      // Verified live: GET the order's full XML, strip the one read-only field PrestaShop rejects
      // (shipping_number) plus <associations>, set <current_state> to the store's "Canceled" order
      // state, PUT it back. The canceled state's id is store-configurable (a fresh install's is 6),
      // so it's resolved by name at call time rather than hardcoded, with 6 as a last-resort
      // fallback if no state name matches "cancel".
      case "orders.cancel": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const canceledStateId = await this.findOrderStateId(/cancel/i, 6);
        let xml = await this.requestXml(`/orders/${encodeURIComponent(orderId)}`);
        xml = this.stripXmlTag(xml, "shipping_number");
        xml = this.stripXmlTag(xml, "associations");
        xml = this.setXmlField(xml, "current_state", String(canceledStateId));
        await this.requestXml(`/orders/${encodeURIComponent(orderId)}`, { method: "PUT", headers: { "Content-Type": "text/xml" }, body: xml });
        return { data: { order_id: orderId, current_state: canceledStateId } };
      }
      // Verified live: POST a new order_slip (PrestaShop's credit-slip/refund record) for every
      // line item on the order, in full — no partial-amount support yet, same "always refund in
      // full" simplification the other e-commerce connectors already make. Only products are
      // refunded, not shipping (total_shipping_tax_excl/incl left at 0).
      //
      // KNOWN LIMITATION, confirmed live and matching a long-open PrestaShop core issue
      // (github.com/PrestaShop/PrestaShop/issues/33109): creating an order_slip this way does NOT
      // update the order_detail rows' own refunded-quantity tracking, unlike refunding through the
      // back office. The credit-slip document itself is real and correct; a merchant's own
      // back-office refund reports may still show the order as not-yet-refunded.
      case "orders.refund": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const order = (await this.request(`/orders/${encodeURIComponent(orderId)}`)) as {
          order?: {
            id_customer?: string; conversion_rate?: string;
            associations?: { order_rows?: { id: string; product_quantity: string; unit_price_tax_excl: string; unit_price_tax_incl: string }[] };
          };
        };
        const o = order.order;
        const rows = o?.associations?.order_rows ?? [];
        if (!o?.id_customer || rows.length === 0) throw new Error(`Order ${orderId} has no line items to refund.`);
        let totalExcl = 0, totalIncl = 0;
        const detailXml = rows.map((r) => {
          const qty = Number(r.product_quantity);
          const amountExcl = Number(r.unit_price_tax_excl) * qty;
          const amountIncl = Number(r.unit_price_tax_incl) * qty;
          totalExcl += amountExcl; totalIncl += amountIncl;
          return `<order_slip_detail><id_order_detail><![CDATA[${r.id}]]></id_order_detail><product_quantity><![CDATA[${qty}]]></product_quantity><amount_tax_excl><![CDATA[${amountExcl.toFixed(6)}]]></amount_tax_excl><amount_tax_incl><![CDATA[${amountIncl.toFixed(6)}]]></amount_tax_incl></order_slip_detail>`;
        }).join("");
        const xml = `<?xml version="1.0" encoding="UTF-8"?><prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><order_slip>` +
          `<id_customer><![CDATA[${o.id_customer}]]></id_customer>` +
          `<id_order><![CDATA[${orderId}]]></id_order>` +
          `<conversion_rate><![CDATA[${o.conversion_rate ?? "1.000000"}]]></conversion_rate>` +
          `<total_products_tax_excl><![CDATA[${totalExcl.toFixed(6)}]]></total_products_tax_excl>` +
          `<total_products_tax_incl><![CDATA[${totalIncl.toFixed(6)}]]></total_products_tax_incl>` +
          `<total_shipping_tax_excl><![CDATA[0.000000]]></total_shipping_tax_excl>` +
          `<total_shipping_tax_incl><![CDATA[0.000000]]></total_shipping_tax_incl>` +
          `<amount><![CDATA[${totalIncl.toFixed(6)}]]></amount>` +
          `<shipping_cost><![CDATA[0]]></shipping_cost>` +
          `<shipping_cost_amount><![CDATA[0.000000]]></shipping_cost_amount>` +
          `<partial><![CDATA[1]]></partial>` +
          `<associations><order_slip_details>${detailXml}</order_slip_details></associations>` +
          `</order_slip></prestashop>`;
        const response = await this.requestXml("/order_slip", { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml });
        const slipId = this.getXmlField(response, "id");
        return { data: { order_id: orderId, order_slip_id: slipId } };
      }
      default:
        throw new Error(`PrestaShop connector does not support tool '${tool}'.`);
    }
  }

  /** Finds the stock_availables row for a (non-combination) product — id_product_attribute=0 is
   *  PrestaShop's convention for "the product itself, not one of its variants." */
  private async findStockAvailableId(productId: string): Promise<string> {
    const params = new URLSearchParams({ "filter[id_product]": productId, "filter[id_product_attribute]": "0" });
    const list = (await this.request("/stock_availables", params)) as { stock_availables?: { id: string }[] };
    const id = list.stock_availables?.[0]?.id;
    if (!id) throw new Error(`No stock_availables entry found for product ${productId}.`);
    return id;
  }

  /** Resolves an order state id by matching its name against `pattern` — a merchant can reorder or
   *  rename PrestaShop's default order states, so this is safer than hardcoding an id. Falls back
   *  to `fallbackId` (PrestaShop's own fresh-install default) if no state name matches. */
  private async findOrderStateId(pattern: RegExp, fallbackId: number): Promise<number> {
    try {
      const params = new URLSearchParams({ display: "full" });
      const list = (await this.request("/order_states", params)) as { order_states?: { id: number; name: string }[] };
      const match = list.order_states?.find((s) => pattern.test(s.name));
      return match ? match.id : fallbackId;
    } catch {
      return fallbackId;
    }
  }
}
