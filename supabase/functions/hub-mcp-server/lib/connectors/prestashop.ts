/**
 * PrestaShop connector — e-commerce, via the store's Webservice API (must be enabled per-store
 * under Advanced Parameters → Webservice). Auth is HTTP Basic with the webservice key as username
 * and an empty password. Responses are XML by default; `output_format`/`io_format` are both used
 * across PrestaShop versions to request JSON instead, so both are sent to cover either. Only
 * search/get are implemented — refund and stock/price writes go through order-slip and
 * stock_availables resources with more version-specific shapes than this connector covers yet.
 * Docs: devdocs.prestashop-project.org/8/webservice/.
 *
 * Base URL/auth/endpoint shape all come from PrestaShop's own official, stable devdocs (not
 * guessed the way JTL's host was) — but unlike sevdesk/personio/lexoffice this hasn't been
 * round-tripped against a real running store yet: no public PrestaShop demo currently has the
 * Webservice API reachable to test against (checked at connector-build time; several guessed demo
 * hostnames returned no PrestaShop response at all). Confirm against a real store's /api/ before
 * enabling.
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
      { domain: "orders", tools: ["orders.search", "orders.get"] },
      { domain: "products", tools: ["products.search", "products.get"] },
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
      default:
        throw new Error(`PrestaShop connector does not support tool '${tool}'.`);
    }
  }
}
