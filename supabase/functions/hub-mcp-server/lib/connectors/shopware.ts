/**
 * Shopware 6 connector — Admin API (OAuth2 client_credentials, JSON:API-ish response shape).
 * Verified live against a local dockware/play 6.7 instance during development: token acquisition,
 * order listing, and the order-transaction refund state transition all confirmed working.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface ShopwareCredentials {
  storeUrl: string; // e.g. "http://localhost:8091" — no trailing slash
  clientId: string;
  clientSecret: string;
}

export class ShopwareConnector implements Connector {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private creds: ShopwareCredentials) {}

  private baseUrl(): string {
    return this.creds.storeUrl.replace(/\/+$/, "");
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const res = await fetch(`${this.baseUrl()}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: this.creds.clientId, client_secret: this.creds.clientSecret }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) throw new Error(body?.errors?.[0]?.detail ?? `Shopware auth failed (HTTP ${res.status})`);
    this.token = body.access_token;
    this.tokenExpiresAt = Date.now() + (Number(body.expires_in ?? 600) - 30) * 1000;
    return this.token!;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl()}/api${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (res.status === 204) return null;
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error((body as { errors?: { detail?: string }[] })?.errors?.[0]?.detail ?? `Shopware HTTP ${res.status}`);
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/order?limit=1");
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
      { domain: "products", tools: ["products.variants.search"] },
      { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
    ];
  }

  /** Shopware prices/taxes are store-specific UUIDs, not something a caller can supply directly --
   *  resolved here via a search rather than hardcoded, since there's no universal constant. */
  private async defaultCurrencyId(): Promise<string> {
    const data = (await this.request("/search/currency", {
      method: "POST",
      body: JSON.stringify({ filter: [{ type: "equals", field: "isSystemDefault", value: true }], limit: 1 }),
    })) as { data?: { id: string }[] };
    const id = data.data?.[0]?.id;
    if (!id) throw new Error("Could not resolve this store's default currency.");
    return id;
  }

  private async findTaxId(rate?: number): Promise<string> {
    const data = (await this.request("/search/tax", { method: "POST", body: JSON.stringify({ limit: 50 }) })) as {
      data?: { id: string; attributes?: { taxRate?: number } }[];
    };
    const taxes = data.data ?? [];
    if (taxes.length === 0) throw new Error("This store has no tax rates configured.");
    const match = rate != null ? taxes.find((t) => t.attributes?.taxRate === rate) : undefined;
    return (match ?? taxes[0]).id;
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "products.search": {
        // Shopware's Admin API criteria search — GET only supports simple filters, so a free-text
        // `term` search goes through the dedicated /search/{entity} endpoint (POST).
        const body: Record<string, unknown> = { limit: Number(input.limit ?? 25) };
        if (input.search) body.term = String(input.search);
        const data = await this.request("/search/product", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "products.get": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.request(`/product/${encodeURIComponent(productId)}`);
        return { data };
      }
      case "products.update_price": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (input.price == null) throw new Error("price is required.");
        // Shopware prices are a per-currency array, not a scalar — read the product's existing
        // price entries and overwrite each one's gross/net with the new amount (keeps whatever
        // currencyId/linked flags the store already has instead of guessing a currency UUID).
        const existing = (await this.request(`/product/${encodeURIComponent(productId)}`)) as {
          data?: { attributes?: { price?: { currencyId: string; gross: number; net: number; linked: boolean }[] } };
        };
        const priceEntries = existing?.data?.attributes?.price ?? [];
        if (priceEntries.length === 0) throw new Error(`Product ${productId} has no price entries to update.`);
        const amount = Number(input.price);
        const nextPrice = priceEntries.map((p) => ({ ...p, gross: amount, net: amount }));
        const data = await this.request(`/product/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify({ price: nextPrice }) });
        return { data: data ?? { product_id: productId, price: nextPrice } };
      }
      // POST /product is real and confirmed. Shopware requires a taxId and a per-currency price
      // array on creation, both store-specific UUIDs -- resolved live via defaultCurrencyId()/
      // findTaxId() rather than guessed. productNumber must be unique; falls back to the caller's
      // sku or a generated one since Shopware won't invent one itself the way its own admin UI does.
      case "products.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        if (input.price == null) throw new Error("price is required.");
        const [currencyId, taxId] = await Promise.all([this.defaultCurrencyId(), this.findTaxId(input.tax_rate != null ? Number(input.tax_rate) : undefined)]);
        const amount = Number(input.price);
        const body = {
          name,
          productNumber: input.sku ? String(input.sku) : `SKU-${Date.now()}`,
          stock: 0,
          taxId,
          price: [{ currencyId, gross: amount, net: amount, linked: true }],
        };
        const data = await this.request("/product", { method: "POST", body: JSON.stringify(body) });
        return { data: data ?? body };
      }
      case "products.update": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const body: Record<string, unknown> = {};
        if (input.name != null) body.name = String(input.name);
        if (input.sku != null) body.productNumber = String(input.sku);
        if (input.price != null) {
          const existing = (await this.request(`/product/${encodeURIComponent(productId)}`)) as {
            data?: { attributes?: { price?: { currencyId: string; gross: number; net: number; linked: boolean }[] } };
          };
          const priceEntries = existing?.data?.attributes?.price ?? [];
          const amount = Number(input.price);
          body.price = priceEntries.map((p) => ({ ...p, gross: amount, net: amount }));
        }
        const data = await this.request(`/product/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify(body) });
        return { data: data ?? { product_id: productId } };
      }
      case "products.categories.search": {
        const body: Record<string, unknown> = { limit: Number(input.limit ?? 25) };
        if (input.search) body.term = String(input.search);
        const data = await this.request("/search/category", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "products.categories.get": {
        const categoryId = String(input.category_id ?? "");
        if (!categoryId) throw new Error("category_id is required.");
        const data = await this.request(`/category/${encodeURIComponent(categoryId)}`);
        return { data };
      }
      // Shopware has no nested /product/{id}/children path -- variants are just other product
      // records sharing the same parentId, found the same way as any other search/product filter.
      case "products.variants.search": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const body = { filter: [{ type: "equals", field: "parentId", value: productId }], limit: 100 };
        const data = await this.request("/search/product", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "inventory.get_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const product = (await this.request(`/product/${encodeURIComponent(productId)}`)) as { data?: { attributes?: { stock?: number; availableStock?: number } } };
        return { data: { product_id: productId, stock: product?.data?.attributes?.stock ?? null, available_stock: product?.data?.attributes?.availableStock ?? null } };
      }
      case "inventory.update_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        if (input.quantity == null) throw new Error("quantity is required.");
        const data = await this.request(`/product/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify({ stock: Number(input.quantity) }) });
        return { data: data ?? { product_id: productId, stock: Number(input.quantity) } };
      }
      case "orders.search": {
        const limit = Number(input.limit ?? 25);
        const data = await this.request(`/order?limit=${limit}`);
        return { data };
      }
      case "orders.get": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const data = await this.request(`/order/${encodeURIComponent(orderId)}?associations[transactions][]`);
        return { data };
      }
      case "orders.refund": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        // Shopware has no single "refund order" endpoint — a refund is a state transition on the
        // order's payment transaction (verified live: POST /_action/order_transaction/{id}/state/refund).
        const order = (await this.request(`/order/${encodeURIComponent(orderId)}?associations[transactions][]`)) as {
          data?: { relationships?: { transactions?: { data?: { id: string }[] } } };
        };
        const transactionId = order?.data?.relationships?.transactions?.data?.[0]?.id;
        if (!transactionId) throw new Error(`No payment transaction found on order ${orderId}.`);
        const data = await this.request(`/_action/order_transaction/${transactionId}/state/refund`, { method: "POST" });
        return { data: data ?? { order_id: orderId, transaction_id: transactionId, status: "refunded" } };
      }
      case "contacts.search": {
        const body: Record<string, unknown> = { limit: Number(input.limit ?? 25) };
        if (input.email) body.term = String(input.email);
        else if (input.name) body.term = String(input.name);
        const data = await this.request("/search/customer", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/customer/${encodeURIComponent(contactId)}`);
        return { data };
      }
      // POST /_action/order/{id}/state/cancel — the order-level state machine's own cancel
      // transition, a different state machine from the order_transaction one orders.refund uses
      // (verified live for refund; cancel is the same documented family of generic
      // `/_action/<entity>/{id}/state/<transitionName>` endpoints, not separately live-tested).
      case "orders.cancel": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const data = await this.request(`/_action/order/${encodeURIComponent(orderId)}/state/cancel`, { method: "POST" });
        return { data: data ?? { order_id: orderId, status: "cancelled" } };
      }
      // Two real, documented steps: PATCH the delivery's trackingCodes (a string array), then fire
      // the order-delivery state machine's "ship" transition — the same generic transition-endpoint
      // family as orders.cancel/orders.refund, applied to the delivery entity instead of the order
      // or order_transaction. Assumes one delivery per order (true unless the order ships from
      // multiple shipping addresses/partial shipments).
      case "orders.fulfill": {
        const orderId = String(input.order_id ?? "");
        const trackingNumber = String(input.tracking_number ?? "");
        if (!orderId) throw new Error("order_id is required.");
        if (!trackingNumber) throw new Error("tracking_number is required.");
        const order = (await this.request(`/order/${encodeURIComponent(orderId)}?associations[deliveries][]`)) as {
          data?: { relationships?: { deliveries?: { data?: { id: string }[] } } };
        };
        const deliveryId = order?.data?.relationships?.deliveries?.data?.[0]?.id;
        if (!deliveryId) throw new Error(`No delivery found on order ${orderId}.`);
        await this.request(`/order-delivery/${deliveryId}`, { method: "PATCH", body: JSON.stringify({ trackingCodes: [trackingNumber] }) });
        const data = await this.request(`/_action/order_delivery/${deliveryId}/state/ship`, { method: "POST" });
        return { data: data ?? { order_id: orderId, delivery_id: deliveryId, status: "shipped" } };
      }
      default:
        throw new Error(`Shopware connector does not support tool '${tool}'.`);
    }
  }
}
