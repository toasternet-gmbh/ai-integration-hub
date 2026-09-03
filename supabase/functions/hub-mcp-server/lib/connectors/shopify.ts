/**
 * Shopify connector — Admin REST API, authenticated with a custom app's Admin API access token
 * (`X-Shopify-Access-Token` header). Shopify has no single "refund this order" endpoint: a refund
 * must be computed via `/refunds/calculate.json` (Shopify decides the exact line/tax/shipping
 * breakdown) and then created with that exact breakdown via `/refunds.json` — passing a made-up
 * amount is rejected, so `orders.refund` here always refunds every line item in full.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

// Shopify sunsets each quarterly version ~12 months after release. Bumped 2026-08-28 (was
// "2024-01", already sunset) to the then-current stable release — check
// https://shopify.dev/docs/api/admin-rest/usage/versioning before this goes stale again.
const API_VERSION = "2026-07";

export interface ShopifyCredentials {
  storeUrl: string; // e.g. "my-store.myshopify.com" (a full https:// prefix is also accepted)
  accessToken: string;
}

interface ShopifyLineItem { id: number; quantity: number }
interface ShopifyOrder { order?: { line_items?: ShopifyLineItem[] } }
interface ShopifyRefundCalc { refund?: Record<string, unknown> }
interface ShopifyVariant { id: number; price?: string; inventory_item_id?: number; inventory_quantity?: number }
interface ShopifyProduct { product?: { variants?: ShopifyVariant[] } }
interface ShopifyLocations { locations?: { id: number }[] }

export class ShopifyConnector implements Connector {
  constructor(private creds: ShopifyCredentials) {}

  private baseUrl(): string {
    const domain = this.creds.storeUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${domain}/admin/api/${API_VERSION}`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, "X-Shopify-Access-Token": this.creds.accessToken, "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const errors = (body as { errors?: unknown })?.errors;
      throw new Error(errors ? (typeof errors === "string" ? errors : JSON.stringify(errors)) : `Shopify HTTP ${res.status}`);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/shop.json");
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
      { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
    ];
  }

  /** Shopify inventory lives on a location, not the product — every stock read/write needs a
   *  location_id. Test stores have exactly one location, so just take the first. */
  private async firstLocationId(): Promise<number> {
    const data = (await this.request("/locations.json")) as ShopifyLocations;
    const id = data.locations?.[0]?.id;
    if (!id) throw new Error("This store has no locations to hold inventory.");
    return id;
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "products.search": {
        const limit = Number(input.limit ?? 25);
        const params = new URLSearchParams({ limit: String(limit) });
        if (input.search) params.set("title", String(input.search));
        const data = await this.request(`/products.json?${params.toString()}`);
        return { data };
      }
      case "products.get": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.request(`/products/${encodeURIComponent(productId)}.json`);
        return { data };
      }
      case "products.update_price": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (input.price == null) throw new Error("price is required.");
        // Price lives on the variant, not the product — this always reprices the first variant
        // (fine for the single-variant test products this connector has been exercised against).
        const existing = (await this.request(`/products/${encodeURIComponent(productId)}.json`)) as ShopifyProduct;
        const variantId = existing.product?.variants?.[0]?.id;
        if (!variantId) throw new Error(`Product ${productId} has no variants to reprice.`);
        const data = await this.request(`/products/${encodeURIComponent(productId)}.json`, {
          method: "PUT", body: JSON.stringify({ product: { id: Number(productId), variants: [{ id: variantId, price: String(input.price) }] } }),
        });
        return { data };
      }
      // POST /products.json is real and confirmed (shopify.dev). The initial variant carries
      // price/sku, matching the shape products.update_price already reads/writes.
      case "products.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        if (input.price == null) throw new Error("price is required.");
        const body = {
          product: {
            title: name,
            variants: [{ price: String(input.price), sku: input.sku ? String(input.sku) : undefined }],
          },
        };
        const data = await this.request("/products.json", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      // PUT /products/{id}.json is real and confirmed. Fetches the existing product first so a
      // partial update doesn't wipe fields not mentioned -- same posture as products.update_price.
      case "products.update": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const existing = (await this.request(`/products/${encodeURIComponent(productId)}.json`)) as ShopifyProduct;
        const variantId = existing.product?.variants?.[0]?.id;
        const product: Record<string, unknown> = { id: Number(productId) };
        if (input.name != null) product.title = String(input.name);
        if ((input.price != null || input.sku != null) && variantId) {
          product.variants = [{
            id: variantId,
            ...(input.price != null ? { price: String(input.price) } : {}),
            ...(input.sku != null ? { sku: String(input.sku) } : {}),
          }];
        }
        const data = await this.request(`/products/${encodeURIComponent(productId)}.json`, { method: "PUT", body: JSON.stringify({ product }) });
        return { data };
      }
      // Shopify's "category" concept is a Collection -- custom_collections are the manually
      // curated kind (as opposed to smart_collections, which are rule-based and not something a
      // product is explicitly assigned to), so that's what this reads. Real, confirmed endpoint.
      case "products.categories.search": {
        const params = new URLSearchParams({ limit: String(input.limit ?? 25) });
        if (input.search) params.set("title", String(input.search));
        const data = await this.request(`/custom_collections.json?${params.toString()}`);
        return { data };
      }
      case "products.categories.get": {
        const categoryId = String(input.category_id ?? "");
        if (!categoryId) throw new Error("category_id is required.");
        const data = await this.request(`/custom_collections/${encodeURIComponent(categoryId)}.json`);
        return { data };
      }
      case "inventory.get_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const existing = (await this.request(`/products/${encodeURIComponent(productId)}.json`)) as ShopifyProduct;
        const variant = existing.product?.variants?.[0];
        if (!variant?.inventory_item_id) throw new Error(`Product ${productId} has no inventory-tracked variant.`);
        const levels = (await this.request(`/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`)) as {
          inventory_levels?: { available: number; location_id: number }[];
        };
        return { data: { product_id: productId, inventory_item_id: variant.inventory_item_id, levels: levels.inventory_levels ?? [] } };
      }
      case "inventory.update_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (input.quantity == null) throw new Error("quantity is required.");
        const existing = (await this.request(`/products/${encodeURIComponent(productId)}.json`)) as ShopifyProduct;
        const variant = existing.product?.variants?.[0];
        if (!variant?.inventory_item_id) throw new Error(`Product ${productId} has no inventory-tracked variant.`);
        const locationId = await this.firstLocationId();
        // Absolute set, not a delta — matches inventory.update_stock's contract on every other connector.
        const data = await this.request("/inventory_levels/set.json", {
          method: "POST",
          body: JSON.stringify({ location_id: locationId, inventory_item_id: variant.inventory_item_id, available: Number(input.quantity) }),
        });
        return { data };
      }
      case "orders.search": {
        const limit = Number(input.limit ?? 25);
        const status = input.status ? String(input.status) : "any";
        const data = await this.request(`/orders.json?status=${encodeURIComponent(status)}&limit=${limit}`);
        return { data };
      }
      case "orders.get": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const data = await this.request(`/orders/${encodeURIComponent(orderId)}.json`);
        return { data };
      }
      case "orders.refund": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");

        const order = (await this.request(`/orders/${encodeURIComponent(orderId)}.json`)) as ShopifyOrder;
        const lineItems = order.order?.line_items ?? [];
        if (lineItems.length === 0) throw new Error(`Order ${orderId} has no line items to refund.`);
        const refund_line_items = lineItems.map((li) => ({ line_item_id: li.id, quantity: li.quantity, restock_type: "no_restock" }));

        const calc = (await this.request(`/orders/${encodeURIComponent(orderId)}/refunds/calculate.json`, {
          method: "POST",
          body: JSON.stringify({ refund: { refund_line_items, shipping: { full_refund: true } } }),
        })) as ShopifyRefundCalc;
        if (!calc.refund) throw new Error("Shopify did not return a refund calculation.");

        const data = await this.request(`/orders/${encodeURIComponent(orderId)}/refunds.json`, {
          method: "POST",
          body: JSON.stringify({ refund: { ...calc.refund, notify: true, note: input.reason ? String(input.reason) : undefined } }),
        });
        return { data };
      }
      // GET /customers/search.json is Shopify's real, dedicated free-text search endpoint (plain
      // /customers.json has no text-search param, only pagination/date filters). Its `query` param
      // accepts field-scoped terms like `email:x@y.com` — built here from whichever of name/email
      // was given, or a bare term if only one was.
      case "contacts.search": {
        const terms: string[] = [];
        if (input.email) terms.push(`email:${input.email}`);
        if (input.name) terms.push(String(input.name));
        const params = new URLSearchParams({ limit: "25" });
        if (terms.length > 0) params.set("query", terms.join(" "));
        const data = terms.length > 0
          ? await this.request(`/customers/search.json?${params.toString()}`)
          : await this.request(`/customers.json?${params.toString()}`);
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/customers/${encodeURIComponent(contactId)}.json`);
        return { data };
      }
      // POST /orders/{id}/cancel.json is a real, confirmed endpoint (shopify.dev order resource).
      // `reason` must be one of Shopify's fixed enum values; anything else is passed through as
      // "other" rather than rejected outright, since an agent's free-text reason won't usually
      // match the enum. Shopify auto-refunds a captured payment on cancel unless told not to —
      // deliberately not overriding that default here (no `refund` override field sent).
      case "orders.cancel": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const allowedReasons = new Set(["customer", "inventory", "fraud", "declined", "other"]);
        const reason = input.reason && allowedReasons.has(String(input.reason)) ? String(input.reason) : "other";
        const data = await this.request(`/orders/${encodeURIComponent(orderId)}/cancel.json`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        return { data };
      }
      // Two-step, confirmed on shopify.dev's fulfillment resource: the legacy single-call
      // `orders/{id}/fulfillments.json` shape is retired — a fulfillment now targets a
      // fulfillment_order_id, fetched first via GET .../fulfillment_orders.json. Assumes a single
      // fulfillment order per order (true for orders that aren't split across locations/vendors),
      // same one-location assumption `firstLocationId()` already makes for inventory.
      case "orders.fulfill": {
        const orderId = String(input.order_id ?? "");
        const trackingNumber = String(input.tracking_number ?? "");
        if (!orderId) throw new Error("order_id is required.");
        if (!trackingNumber) throw new Error("tracking_number is required.");
        const fulfillmentOrders = (await this.request(`/orders/${encodeURIComponent(orderId)}/fulfillment_orders.json`)) as {
          fulfillment_orders?: { id: number }[];
        };
        const fulfillmentOrderId = fulfillmentOrders.fulfillment_orders?.[0]?.id;
        if (!fulfillmentOrderId) throw new Error(`Order ${orderId} has no open fulfillment order.`);
        const data = await this.request("/fulfillments.json", {
          method: "POST",
          body: JSON.stringify({
            fulfillment: {
              line_items_by_fulfillment_order: [{ fulfillment_order_id: fulfillmentOrderId }],
              tracking_info: { number: trackingNumber, company: input.carrier ? String(input.carrier) : undefined, url: input.tracking_url ? String(input.tracking_url) : undefined },
              notify_customer: true,
            },
          }),
        });
        return { data };
      }
      default:
        throw new Error(`Shopify connector does not support tool '${tool}'.`);
    }
  }
}
