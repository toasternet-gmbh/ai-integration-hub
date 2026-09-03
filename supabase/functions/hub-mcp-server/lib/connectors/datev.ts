/**
 * DATEV connector — bookkeeping. BEST-EFFORT / UNVERIFIED, unlike every other connector in this
 * codebase: DATEV does not offer public self-service API signup or a sandbox. Real access
 * requires becoming a certified DATEV Marktplatz solution partner — a formal application process
 * with no guaranteed timeline — so this connector's exact endpoint paths and error response shape
 * could not be confirmed against a live account before shipping, only inferred from DATEV's public
 * developer-portal marketing pages (developer.datev.de), which describe an OAuth2 client-
 * credentials model but do not expose a testable token endpoint to an unregistered caller.
 *
 * Ships with `hub_platform_types.enabled = false` and is expected to stay that way until this
 * Hub itself completes DATEV's partner certification and the shape below can be corrected against
 * a real account. Do not treat this file as verified the way lexoffice.ts/sevdesk.ts are.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface DatevCredentials {
  clientId: string;
  clientSecret: string;
}

export class DatevConnector implements Connector {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private creds: DatevCredentials) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.token;

    // Best-effort endpoint — DATEV's own docs describe OAuth2 client-credentials but publish no
    // token URL reachable without partner registration; unconfirmed against a real account.
    const res = await fetch("https://api.datev.de/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.creds.clientId, client_secret: this.creds.clientSecret }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error_description?: string; error?: string })?.error_description
        ?? (body as { error?: string })?.error
        ?? `DATEV HTTP ${res.status}`;
      throw new Error(message);
    }
    const { access_token, expires_in } = body as { access_token: string; expires_in?: number };
    if (!access_token) throw new Error("DATEV token response did not include an access_token.");
    this.cachedToken = { token: access_token, expiresAt: Date.now() + (expires_in ?? 3600) * 1000 };
    return access_token;
  }

  private async request(path: string): Promise<unknown> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://api.datev.de/platform/v1${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `DATEV HTTP ${res.status}`;
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
      { domain: "invoices", tools: ["invoices.search", "invoices.get"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "invoices.search": {
        const params = new URLSearchParams();
        if (input.status) params.set("status", String(input.status));
        const data = await this.request(`/invoices?${params.toString()}`);
        return { data };
      }
      case "invoices.get": {
        const invoiceId = String(input.invoice_id ?? "");
        if (!invoiceId) throw new Error("invoice_id is required.");
        const data = await this.request(`/invoices/${encodeURIComponent(invoiceId)}`);
        return { data };
      }
      case "contacts.search": {
        const data = await this.request("/contacts");
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.request(`/contacts/${encodeURIComponent(contactId)}`);
        return { data };
      }
      default:
        throw new Error(`DATEV connector does not support tool '${tool}'.`);
    }
  }
}
