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
    return [{ domain: "orders", tools: ["orders.search", "orders.get", "orders.refund"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
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
      default:
        throw new Error(`Shopware connector does not support tool '${tool}'.`);
    }
  }
}
