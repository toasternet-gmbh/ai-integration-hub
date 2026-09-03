/**
 * WooCommerce connector (Milestone 1's first connector) — WooCommerce REST API v3.
 * Auth: Consumer Key/Secret over HTTPS Basic Auth (the standard approach for an HTTPS store;
 * OAuth1.0a query-param signing for plain-HTTP stores is deferred — not needed for Milestone 1).
 *
 * No orders.fulfill here: WooCommerce core's order resource has no tracking-number field at all —
 * shipment tracking only exists via third-party plugins (WooCommerce Shipment Tracking, Advanced
 * Shipment Tracking, ...), each with its own non-standard endpoint, so there's no one call that
 * works on every WooCommerce store the way there is on Shopify/Magento/Shopware. Deliberately left
 * unimplemented rather than silently doing nothing or depending on a plugin that may not be installed.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface WooCommerceCredentials {
  storeUrl: string; // e.g. "https://mystore.com" (no trailing slash, no /wp-json suffix)
  consumerKey: string;
  consumerSecret: string;
}

export class WooCommerceConnector implements Connector {
  constructor(private creds: WooCommerceCredentials) {}

  private baseUrl(): string {
    return `${this.creds.storeUrl.replace(/\/+$/, "")}/wp-json/wc/v3`;
  }

  private authHeader(): string {
    return "Basic " + btoa(`${this.creds.consumerKey}:${this.creds.consumerSecret}`);
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: this.authHeader(), "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `WooCommerce HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/orders?per_page=1");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund", "orders.cancel"] },
      { domain: "products", tools: ["products.search", "products.get", "products.update_price"] },
      { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "products.search": {
        const params = new URLSearchParams();
        if (input.search) params.set("search", String(input.search));
        params.set("per_page", String(input.limit ?? 25));
        const data = await this.request(`/products?${params.toString()}`);
        return { data };
      }
      case "products.get": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.request(`/products/${encodeURIComponent(productId)}`);
        return { data };
      }
      case "products.update_price": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (input.price == null) throw new Error("price is required.");
        const data = await this.request(`/products/${encodeURIComponent(productId)}`, {
          method: "PUT", body: JSON.stringify({ regular_price: String(input.price) }),
        });
        return { data };
      }
      case "inventory.get_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const product = (await this.request(`/products/${encodeURIComponent(productId)}`)) as Record<string, unknown>;
        return { data: { product_id: productId, stock_quantity: product.stock_quantity ?? null, manage_stock: product.manage_stock, stock_status: product.stock_status } };
      }
      case "inventory.update_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (input.quantity == null) throw new Error("quantity is required.");
        const data = await this.request(`/products/${encodeURIComponent(productId)}`, {
          method: "PUT", body: JSON.stringify({ manage_stock: true, stock_quantity: Number(input.quantity) }),
        });
        return { data };
      }
      case "orders.search": {
        const params = new URLSearchParams();
        if (input.status) params.set("status", String(input.status));
        params.set("per_page", String(input.limit ?? 25));
        const data = await this.request(`/orders?${params.toString()}`);
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
        const body: Record<string, unknown> = {};
        if (input.amount != null) body.amount = String(input.amount);
        if (input.reason) body.reason = String(input.reason);
        try {
          const data = await this.request(`/orders/${encodeURIComponent(orderId)}/refunds`, { method: "POST", body: JSON.stringify(body) });
          return { data };
        } catch (err) {
          // Many payment methods (bank transfer, cash, most non-Stripe/PayPal gateways) don't
          // support WooCommerce's automatic gateway refund callback — fall back to recording the
          // refund without it (api_refund: false), which still marks the order refunded. Without
          // this fallback, orders.refund would only ever work for a handful of gateways.
          if (!(err instanceof Error) || !err.message.includes("does not support automatic refunds")) throw err;
          const data = await this.request(`/orders/${encodeURIComponent(orderId)}/refunds`, {
            method: "POST",
            body: JSON.stringify({ ...body, api_refund: false }),
          });
          return { data };
        }
      }
      case "contacts.search": {
        const params = new URLSearchParams();
        if (input.email) params.set("email", String(input.email));
        else if (input.name) params.set("search", String(input.name));
        params.set("per_page", "25");
        const data = await this.request(`/customers?${params.toString()}`);
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/customers/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // Same generic order-status PUT the rest of this connector already uses — WooCommerce has no
      // separate cancel endpoint, "cancelled" is just one of its documented status enum values.
      case "orders.cancel": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const data = await this.request(`/orders/${encodeURIComponent(orderId)}`, {
          method: "PUT",
          body: JSON.stringify({ status: "cancelled" }),
        });
        return { data };
      }
      default:
        throw new Error(`WooCommerce connector does not support tool '${tool}'.`);
    }
  }
}
