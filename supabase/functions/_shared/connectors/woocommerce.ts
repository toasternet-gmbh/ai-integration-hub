/**
 * WooCommerce connector (Milestone 1's first connector) — WooCommerce REST API v3.
 * Auth: Consumer Key/Secret over HTTPS Basic Auth (the standard approach for an HTTPS store;
 * OAuth1.0a query-param signing for plain-HTTP stores is deferred — not needed for Milestone 1).
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
    return [{ domain: "orders", tools: ["orders.search", "orders.get", "orders.refund"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
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
      default:
        throw new Error(`WooCommerce connector does not support tool '${tool}'.`);
    }
  }
}
