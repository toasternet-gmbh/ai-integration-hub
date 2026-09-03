/**
 * Magento 2 connector — REST API, authenticated with an Integration's Bearer access token
 * (Admin → System → Extensions → Integrations; a token-based integration's access token doesn't
 * expire until the integration is revoked, unlike the admin-login token endpoint).
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface MagentoCredentials {
  storeUrl: string; // e.g. "https://my-magento.example.com" (no trailing slash)
  accessToken: string;
}

export class MagentoConnector implements Connector {
  constructor(private creds: MagentoCredentials) {}

  private baseUrl(): string {
    return `${this.creds.storeUrl.replace(/\/+$/, "")}/rest/V1`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.creds.accessToken}`, "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `Magento HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/orders?searchCriteria[pageSize]=1");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund", "orders.cancel", "orders.fulfill"] },
      { domain: "products", tools: ["products.search", "products.get", "products.update_price", "products.create", "products.update"] },
      { domain: "products", tools: ["products.categories.search", "products.categories.get"] },
      { domain: "products", tools: ["products.images.search", "products.images.create"] },
      { domain: "products", tools: ["products.variants.search"] },
      { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
      { domain: "contacts", tools: ["contacts.addresses.search", "contacts.addresses.create"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      // Magento identifies products by SKU, not a numeric id — `product_id` here is always a SKU.
      case "products.search": {
        const params = new URLSearchParams();
        params.set("searchCriteria[pageSize]", String(input.limit ?? 25));
        if (input.search) {
          params.set("searchCriteria[filterGroups][0][filters][0][field]", "name");
          params.set("searchCriteria[filterGroups][0][filters][0][value]", `%${input.search}%`);
          params.set("searchCriteria[filterGroups][0][filters][0][conditionType]", "like");
        }
        const data = await this.request(`/products?${params.toString()}`);
        return { data };
      }
      case "products.get": {
        const sku = String(input.product_id ?? "");
        if (!sku) throw new Error("product_id (SKU) is required.");
        const data = await this.request(`/products/${encodeURIComponent(sku)}`);
        return { data };
      }
      case "products.update_price": {
        const sku = String(input.product_id ?? "");
        if (!sku) throw new Error("product_id (SKU) is required.");
        if (input.price == null) throw new Error("price is required.");
        const data = await this.request(`/products/${encodeURIComponent(sku)}`, {
          method: "PUT", body: JSON.stringify({ product: { sku, price: Number(input.price) } }),
        });
        return { data };
      }
      // POST /V1/products is real and confirmed. `sku` doubles as `name` when the caller doesn't
      // supply one via product_id (there's no separate id at create time -- SKU is chosen here,
      // not assigned by Magento) -- if the caller wants a specific SKU they should pass it via
      // `sku`, otherwise the product name is reused. attributeSetId=4 (Default) and typeId=simple
      // are Magento's own out-of-the-box defaults on every fresh install.
      case "products.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        if (input.price == null) throw new Error("price is required.");
        const sku = input.sku ? String(input.sku) : name;
        const body = {
          product: {
            sku, name, price: Number(input.price),
            attributeSetId: 4, typeId: "simple", status: 1, visibility: 4,
          },
        };
        const data = await this.request("/products", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "products.update": {
        const sku = String(input.product_id ?? "");
        if (!sku) throw new Error("product_id (SKU) is required.");
        const product: Record<string, unknown> = { sku };
        if (input.name != null) product.name = String(input.name);
        if (input.price != null) product.price = Number(input.price);
        const data = await this.request(`/products/${encodeURIComponent(sku)}`, { method: "PUT", body: JSON.stringify({ product }) });
        return { data };
      }
      // GET /V1/categories/list is real and confirmed -- Magento's category tree is queried with
      // the same searchCriteria filter shape products.search already uses.
      case "products.categories.search": {
        const params = new URLSearchParams();
        params.set("searchCriteria[pageSize]", String(input.limit ?? 25));
        if (input.search) {
          params.set("searchCriteria[filterGroups][0][filters][0][field]", "name");
          params.set("searchCriteria[filterGroups][0][filters][0][value]", `%${input.search}%`);
          params.set("searchCriteria[filterGroups][0][filters][0][conditionType]", "like");
        }
        const data = await this.request(`/categories/list?${params.toString()}`);
        return { data };
      }
      case "products.categories.get": {
        const categoryId = String(input.category_id ?? "");
        if (!categoryId) throw new Error("category_id is required.");
        const data = await this.request(`/categories/${encodeURIComponent(categoryId)}`);
        return { data };
      }
      // GET /V1/configurable-products/{sku}/children is real and confirmed -- returns the full
      // child (simple) product objects that make up a configurable product's variants.
      case "products.variants.search": {
        const sku = String(input.product_id ?? "");
        if (!sku) throw new Error("product_id (SKU) is required.");
        const data = await this.request(`/configurable-products/${encodeURIComponent(sku)}/children`);
        return { data };
      }
      // GET/POST /V1/products/{sku}/media are real, confirmed endpoints. Upload embeds the file as
      // base64 in `entry.content.base64_encoded_data` -- Magento's own convention, no multipart.
      case "products.images.search": {
        const sku = String(input.product_id ?? "");
        if (!sku) throw new Error("product_id (SKU) is required.");
        const data = await this.request(`/products/${encodeURIComponent(sku)}/media`);
        return { data };
      }
      case "products.images.create": {
        const sku = String(input.product_id ?? "");
        const fileBase64 = String(input.file_base64 ?? "");
        const fileName = String(input.file_name ?? "");
        if (!sku) throw new Error("product_id (SKU) is required.");
        if (!fileBase64 || !fileName) throw new Error("file_base64 and file_name are required.");
        const body = {
          entry: {
            media_type: "image",
            label: fileName,
            position: 1,
            disabled: false,
            types: ["image"],
            content: { base64_encoded_data: fileBase64, type: String(input.mime_type ?? "image/jpeg"), name: fileName },
          },
        };
        const data = await this.request(`/products/${encodeURIComponent(sku)}/media`, { method: "POST", body: JSON.stringify(body) });
        return { data: { media_id: data } };
      }
      // Magento's customer object already embeds an `addresses` array (surfaced via
      // contacts.get) -- this reads the same field for a dedicated "just the addresses" view.
      // POST /V1/addresses is the real, confirmed endpoint for adding a new one.
      case "contacts.addresses.search": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const customer = (await this.request(`/customers/${encodeURIComponent(contactId)}`)) as { addresses?: unknown };
        return { data: customer.addresses ?? [] };
      }
      case "contacts.addresses.create": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        if (!input.address1 || !input.city || !input.zip || !input.country) throw new Error("address1, city, zip, and country are required.");
        const body = {
          address: {
            customerId: Number(contactId),
            firstname: input.first_name ? String(input.first_name) : "",
            lastname: input.last_name ? String(input.last_name) : "",
            street: [String(input.address1)],
            city: String(input.city),
            postcode: String(input.zip),
            countryId: String(input.country),
            telephone: input.phone ? String(input.phone) : "",
          },
        };
        const data = await this.request("/addresses", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "inventory.get_stock": {
        const sku = String(input.product_id ?? "");
        if (!sku) throw new Error("product_id (SKU) is required.");
        const product = (await this.request(`/products/${encodeURIComponent(sku)}`)) as {
          extension_attributes?: { stock_item?: { qty?: number; is_in_stock?: boolean } };
        };
        const stockItem = product.extension_attributes?.stock_item;
        return { data: { product_id: sku, qty: stockItem?.qty ?? null, is_in_stock: stockItem?.is_in_stock ?? null } };
      }
      case "inventory.update_stock": {
        const sku = String(input.product_id ?? "");
        if (!sku) throw new Error("product_id (SKU) is required.");
        if (input.quantity == null) throw new Error("quantity is required.");
        // Magento saves the stock_item alongside the product when passed via extension_attributes
        // on a product PUT — no separate stockItems endpoint call needed.
        const qty = Number(input.quantity);
        const data = await this.request(`/products/${encodeURIComponent(sku)}`, {
          method: "PUT",
          body: JSON.stringify({ product: { sku, extension_attributes: { stock_item: { qty, is_in_stock: qty > 0 } } } }),
        });
        return { data };
      }
      case "orders.search": {
        const pageSize = Number(input.limit ?? 25);
        const data = await this.request(`/orders?searchCriteria[pageSize]=${pageSize}`);
        return { data };
      }
      case "orders.get": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const data = await this.request(`/orders/${encodeURIComponent(orderId)}`);
        return { data };
      }
      case "orders.refund": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        // Omitting `items` refunds every remaining quantity on the order — Magento's documented
        // behavior for POST /V1/order/{id}/refund — matching the "always refund in full" approach
        // used by the WooCommerce/Shopware/Shopify connectors (no partial-refund UI yet).
        const body: Record<string, unknown> = { arguments: {} };
        if (input.reason) body.comment = { comment: String(input.reason), is_visible_on_front: 0 };
        const creditMemoId = await this.request(`/order/${encodeURIComponent(orderId)}/refund`, { method: "POST", body: JSON.stringify(body) });
        return { data: { credit_memo_id: creditMemoId } };
      }
      case "contacts.search": {
        const params = new URLSearchParams();
        params.set("searchCriteria[pageSize]", "25");
        if (input.email) {
          params.set("searchCriteria[filterGroups][0][filters][0][field]", "email");
          params.set("searchCriteria[filterGroups][0][filters][0][value]", String(input.email));
        } else if (input.name) {
          params.set("searchCriteria[filterGroups][0][filters][0][field]", "firstname");
          params.set("searchCriteria[filterGroups][0][filters][0][value]", `%${input.name}%`);
          params.set("searchCriteria[filterGroups][0][filters][0][conditionType]", "like");
        }
        const data = await this.request(`/customers/search?${params.toString()}`);
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/customers/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // POST /orders/{id}/cancel is a real, confirmed endpoint — returns a bare boolean, not an
      // order object. Fails once the order has an invoice, same "can't undo a completed payment
      // this way" posture orders.refund exists for.
      case "orders.cancel": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const cancelled = await this.request(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" });
        return { data: { order_id: orderId, cancelled } };
      }
      // POST /order/{id}/ship is a real, confirmed endpoint, but its `items` array (order_item_id +
      // qty per line) is required, not optional — Magento won't infer "ship everything" the way
      // Shopify's refund-calculate does, so the order is fetched first to ship every line in full.
      // `carrier_code: "custom"` is Magento's well-known fallback code for a tracking number that
      // isn't from a carrier registered as a real shipping method in the store.
      case "orders.fulfill": {
        const orderId = String(input.order_id ?? "");
        const trackingNumber = String(input.tracking_number ?? "");
        if (!orderId) throw new Error("order_id is required.");
        if (!trackingNumber) throw new Error("tracking_number is required.");
        const order = (await this.request(`/orders/${encodeURIComponent(orderId)}`)) as { items?: { item_id: number; qty_ordered: number }[] };
        const items = (order.items ?? []).map((i) => ({ order_item_id: i.item_id, qty: i.qty_ordered }));
        if (items.length === 0) throw new Error(`Order ${orderId} has no items to ship.`);
        const body = {
          items,
          tracks: [{ track_number: trackingNumber, carrier_code: "custom", title: input.carrier ? String(input.carrier) : "Carrier" }],
        };
        const shipmentId = await this.request(`/order/${encodeURIComponent(orderId)}/ship`, { method: "POST", body: JSON.stringify(body) });
        return { data: { shipment_id: shipmentId } };
      }
      default:
        throw new Error(`Magento connector does not support tool '${tool}'.`);
    }
  }
}
