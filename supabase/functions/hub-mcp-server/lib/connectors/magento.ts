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
      { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund"] },
      { domain: "products", tools: ["products.search", "products.get", "products.update_price"] },
      { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
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
      default:
        throw new Error(`Magento connector does not support tool '${tool}'.`);
    }
  }
}
