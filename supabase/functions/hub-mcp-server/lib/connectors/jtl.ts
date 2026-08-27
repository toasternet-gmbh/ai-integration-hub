/**
 * JTL connector — e-commerce. BEST-EFFORT / LOW CONFIDENCE: "JTL" most commonly means JTL-Wawi,
 * the on-premise ERP most German merchants actually run, which has no public REST API for order
 * lookup the way WooCommerce/Shopify do — it's normally reached via JTL-Connector middleware or a
 * direct local network/DB link, neither of which fits this Hub's cloud-integration model.
 *
 * What IS a real, documented REST/GraphQL surface is JTL's own "Platform APIs" — part of the newer
 * JTL Cloud Apps ecosystem for marketplace/channel sync (developer.jtl-software.com), which this
 * connector targets instead. That means connecting "JTL" here really connects a JTL Channel, not
 * a specific JTL-Wawi installation — a materially different thing from what a merchant asking
 * "can I connect my JTL shop" probably expects. Exact endpoint paths/auth details below are
 * inferred from developer-portal marketing pages, not a verified working integration.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface JtlCredentials {
  clientId: string;
  clientSecret: string;
}

export class JtlConnector implements Connector {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private creds: JtlCredentials) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.token;

    // Best-effort endpoint — inferred, not verified against a real JTL channel/account.
    const res = await fetch("https://auth.jtl-software.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.creds.clientId, client_secret: this.creds.clientSecret }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error_description?: string; error?: string })?.error_description
        ?? (body as { error?: string })?.error
        ?? `JTL HTTP ${res.status}`;
      throw new Error(message);
    }
    const { access_token, expires_in } = body as { access_token: string; expires_in?: number };
    if (!access_token) throw new Error("JTL token response did not include an access_token.");
    this.cachedToken = { token: access_token, expiresAt: Date.now() + (expires_in ?? 3600) * 1000 };
    return access_token;
  }

  private async request(path: string): Promise<unknown> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://api.jtl-software.com/platform/v1${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `JTL HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.getAccessToken();
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
      case "orders.search": {
        const params = new URLSearchParams();
        if (input.status) params.set("status", String(input.status));
        if (input.limit) params.set("limit", String(input.limit));
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
        const token = await this.getAccessToken();
        const res = await fetch(`https://api.jtl-software.com/platform/v1/orders/${encodeURIComponent(orderId)}/refunds`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ amount: input.amount, reason: input.reason }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error((body as { message?: string })?.message ?? `JTL HTTP ${res.status}`);
        return { data: body };
      }
      case "products.search": {
        const params = new URLSearchParams();
        if (input.search) params.set("search", String(input.search));
        if (input.limit) params.set("limit", String(input.limit));
        const data = await this.request(`/offers?${params.toString()}`);
        return { data };
      }
      case "products.get": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.request(`/offers/${encodeURIComponent(productId)}`);
        return { data };
      }
      case "products.update_price":
      case "inventory.update_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const token = await this.getAccessToken();
        const body = tool === "products.update_price" ? { price: input.price } : { quantity: input.quantity };
        const res = await fetch(`https://api.jtl-software.com/platform/v1/offers/${encodeURIComponent(productId)}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
        });
        const responseBody = await res.json().catch(() => null);
        if (!res.ok) throw new Error((responseBody as { message?: string })?.message ?? `JTL HTTP ${res.status}`);
        return { data: responseBody };
      }
      case "inventory.get_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.request(`/offers/${encodeURIComponent(productId)}/stock`);
        return { data };
      }
      default:
        throw new Error(`JTL connector does not support tool '${tool}'.`);
    }
  }
}
