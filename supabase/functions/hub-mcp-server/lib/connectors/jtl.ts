/**
 * JTL connector — e-commerce. Rewritten 2026-09-03 after discovering the previous implementation
 * was built on entirely wrong assumptions: it targeted REST hosts `auth.jtl-software.com` /
 * `api.jtl-software.com/platform/v1`, which don't match JTL's real, current developer portal.
 *
 * The real JTL Cloud API is GraphQL, confirmed directly against the official auto-generated SDL
 * reference (developer.jtl-software.com/cloud/api-reference/erp/v2.1/graphql-schema.md, fetched
 * raw — 26,000 lines, not a marketing summary) and the official auth guide
 * (developer.jtl-software.com/cloud/guides/essentials/authentication/oauth2-flow.md):
 *   - Token: POST https://auth.jtl-cloud.com/oauth2/token, Basic clientId:clientSecret,
 *     grant_type=client_credentials (same shape the old connector already had right).
 *   - Data: POST https://api.jtl-cloud.com/erp/v2/graphql, single GraphQL endpoint, with BOTH
 *     `Authorization: Bearer <token>` AND a required `X-Tenant-ID: <tenantId>` header identifying
 *     which merchant's data to access — this header did not exist in the old implementation at
 *     all and is not optional.
 *   - Self-serve, not partner-gated like DATEV: register at partner.jtl-cloud.com, get
 *     Client ID/Secret immediately, no approval queue.
 *
 * Scope: reads only (orders.search/get, products.search/get, inventory.get_stock,
 * contacts.search/get) — all query names and field shapes below are copied directly from the
 * real schema (spec-verified, the same confidence tier as sevDesk's OpenAPI-spec-backed tools).
 * products.update_price/inventory.update_stock/orders.refund from the old (non-working) connector
 * were dropped rather than carried forward: real write mutations do exist (ChangeItem,
 * CreateSalesOrder/UpdateSalesOrder, stock-posting commands), but their input shapes are far more
 * complex (deeply nested Update*Input structures) than could be confidently implemented and
 * verified this round — a future pass, not guessed here.
 *
 * "JTL" here means a JTL Cloud sales channel/tenant, not a JTL-Wawi desktop installation directly
 * (JTL-Wawi's own local API uses a completely different auth scheme and base URL, not this one).
 *
 * Still unverified against a real account — schema-confirmed, not live-tested — ships disabled.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface JtlCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export class JtlConnector implements Connector {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private creds: JtlCredentials) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.token;

    const res = await fetch("https://auth.jtl-cloud.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${this.creds.clientId}:${this.creds.clientSecret}`),
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error_description?: string; error?: string })?.error_description
        ?? (body as { error?: string })?.error
        ?? `JTL auth HTTP ${res.status}`;
      throw new Error(message);
    }
    const { access_token, expires_in } = body as { access_token: string; expires_in?: number };
    if (!access_token) throw new Error("JTL token response did not include an access_token.");
    this.cachedToken = { token: access_token, expiresAt: Date.now() + (expires_in ?? 3600) * 1000 };
    return access_token;
  }

  private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch("https://api.jtl-cloud.com/erp/v2/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": this.creds.tenantId,
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json().catch(() => null)) as GraphQLResponse<T> | null;
    if (!res.ok || body?.errors?.length) {
      const message = body?.errors?.[0]?.message ?? `JTL HTTP ${res.status}`;
      throw new Error(message);
    }
    if (!body?.data) throw new Error("JTL GraphQL response had no data.");
    return body.data;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      // Cheapest real probe: a token exchange plus a minimal, side-effect-free query confirms
      // both the OAuth credentials and the tenant id/header are correct.
      await this.graphql(`query { QueryItems(first: 1) { totalCount } }`);
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "orders", tools: ["orders.search", "orders.get"] },
      { domain: "products", tools: ["products.search", "products.get"] },
      { domain: "inventory", tools: ["inventory.get_stock"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      // QuerySalesOrders/SalesOrderListItem field names confirmed directly in the schema.
      case "orders.search": {
        const data = await this.graphql<{ QuerySalesOrders: { totalCount: number; nodes: unknown[] } }>(
          `query($first: Int) {
            QuerySalesOrders(first: $first) {
              totalCount
              nodes { id salesOrderNumber salesOrderDate salesOrderStatus isCancelled isPending totalGrossAmount customerId }
            }
          }`,
          { first: Number(input.limit ?? 25) },
        );
        return { data: data.QuerySalesOrders };
      }
      case "orders.get": {
        const orderId = String(input.order_id ?? "");
        if (!orderId) throw new Error("order_id is required.");
        const data = await this.graphql<{ GetSalesOrderById: unknown }>(
          `query($id: ID!) {
            GetSalesOrderById(salesOrderId: $id) {
              id salesOrderNumber salesOrderDate salesOrderStatus isCancelled isPending customerId
              lineItems { sku name quantity salesPriceNet salesPriceGross totalSalesPriceNet totalSalesPriceGross taxRate }
              keyFigures { totalGrossAmount totalNetAmount stillToPay paymentStatus deliveryStatus }
            }
          }`,
          { id: orderId },
        );
        return { data: data.GetSalesOrderById };
      }
      // QueryItems/ItemListItem field names confirmed directly in the schema. searchTerm is a
      // real, documented free-text filter, not a client-side workaround like several other
      // connectors in this codebase need.
      case "products.search": {
        const data = await this.graphql<{ QueryItems: { totalCount: number; nodes: unknown[] } }>(
          `query($first: Int, $searchTerm: String) {
            QueryItems(first: $first, searchTerm: $searchTerm) {
              totalCount
              nodes { id sku name unit description }
            }
          }`,
          { first: Number(input.limit ?? 25), searchTerm: input.search ? String(input.search) : null },
        );
        return { data: data.QueryItems };
      }
      case "products.get": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.graphql<{ GetItemById: unknown }>(
          `query($id: ID!) {
            GetItemById(itemId: $id) {
              id
              identifiers { sku gtin manufacturerNumber }
              descriptions { defaultDescriptions { languageIso descriptionData { itemName shortDescription } } }
              prices { salesPriceNet suggestedRetailPrice }
            }
          }`,
          { id: productId },
        );
        return { data: data.GetItemById };
      }
      // GetStockByItemId/ItemStock field names confirmed directly in the schema -- returns
      // cross-warehouse totals directly, no separate per-warehouse lookup needed for a simple
      // stock check (that's QueryStock, a different, more granular query this tool doesn't use).
      case "inventory.get_stock": {
        const productId = String(input.product_id ?? "");
        if (!productId) throw new Error("product_id is required.");
        const data = await this.graphql<{ GetStockByItemId: { totalQuantity: number; availableQuantity: number } }>(
          `query($id: ID!) { GetStockByItemId(itemId: $id) { totalQuantity availableQuantity } }`,
          { id: productId },
        );
        return { data: { product_id: productId, ...data.GetStockByItemId } };
      }
      // QueryCustomers/CustomerListItem field names confirmed directly in the schema.
      case "contacts.search": {
        const searchTerm = input.email ? String(input.email) : input.name ? String(input.name) : null;
        const data = await this.graphql<{ QueryCustomers: { totalCount: number; nodes: unknown[] } }>(
          `query($first: Int, $searchTerm: String) {
            QueryCustomers(first: $first, searchTerm: $searchTerm) {
              totalCount
              nodes { id customerNumber firstName lastName emailAddress companyName }
            }
          }`,
          { first: 25, searchTerm },
        );
        return { data: data.QueryCustomers };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.graphql<{ GetCustomerById: unknown }>(
          `query($id: ID!) {
            GetCustomerById(customerId: $id) {
              customerId customerNumber languageIso isLocked
              customerAddresses { firstName lastName emailAddress companyName street city postalCode countryIso phoneNumber isDefault addressType }
            }
          }`,
          { id: contactId },
        );
        return { data: data.GetCustomerById };
      }
      default:
        throw new Error(`JTL connector does not support tool '${tool}'.`);
    }
  }
}
