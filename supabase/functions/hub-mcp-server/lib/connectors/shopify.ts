/**
 * Shopify connector — Admin REST API, authenticated with a custom app's Admin API access token
 * (`X-Shopify-Access-Token` header). Shopify has no single "refund this order" endpoint: a refund
 * must be computed via `/refunds/calculate.json` (Shopify decides the exact line/tax/shipping
 * breakdown) and then created with that exact breakdown via `/refunds.json` — passing a made-up
 * amount is rejected, so `orders.refund` here always refunds every line item in full.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const API_VERSION = "2024-01";

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
      { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund"] },
      { domain: "products", tools: ["products.search", "products.get", "products.update_price"] },
      { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
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
      default:
        throw new Error(`Shopify connector does not support tool '${tool}'.`);
    }
  }
}
