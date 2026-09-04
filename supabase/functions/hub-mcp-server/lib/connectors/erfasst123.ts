/**
 * 123erfasst connector — time tracking (German, construction/trades). BEST-EFFORT / UNVERIFIED,
 * same tier as datev.ts: 123erfasst exposes a GraphQL API (server.123erfasst.de/docs/api/) whose
 * auth is itself dynamic — an `authProvider` query is assumed to return a per-account OpenID
 * Connect configuration (`clientIdentification`, `clientSecret`, `authorizeEndpoint`,
 * `tokenEndpoint`), meaning the actual OAuth endpoints aren't a fixed, publicly documented URL the
 * way even DATEV's are, but discovered per tenant. Confirming the exact discovery query and the
 * projects/workdays query/mutation shapes needs a live account or a direct line to 123erfasst
 * (their own public docs describe "importing master data" and "exporting all data" only in prose,
 * not schema) — neither has been available so far.
 *
 * Live-tested 2026-09-04 against the real endpoint: POST /graphql only accepts POST (GET/OPTIONS
 * return 405), confirming the host and path are real — but EVERY POST, including a bare
 * `{__typename}` with no query variables and no Authorization header at all, returns a blanket
 * `401` with an empty body. That contradicts this connector's core assumption that `authProvider`
 * is a public, unauthenticated discovery query: in practice the whole endpoint appears to require
 * some form of auth before any query runs, even discovery, and the 401 body carries no error
 * detail to say what that is (an API key header? IP allowlisting? something else 123erfasst
 * documents only to partners?). `getAccessToken()` below is therefore best-effort in a stronger
 * sense than just "unconfirmed" — its whole bootstrap premise may not hold. Ships `enabled: true`
 * per a founder decision to prioritize MCP tool availability generally (see CLAUDE.md's Known
 * Gaps), not because this was verified — do not treat this file as verified.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const ENDPOINT = "https://server.123erfasst.de/graphql";

export interface Erfasst123Credentials {
  clientId: string;
  clientSecret: string;
}

export class Erfasst123Connector implements Connector {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private creds: Erfasst123Credentials) {}

  private async graphql(query: string, variables?: Record<string, unknown>, token?: string): Promise<unknown> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json().catch(() => null)) as { data?: unknown; errors?: { message: string }[] } | null;
    if (!res.ok || body?.errors?.length) {
      const message = body?.errors?.[0]?.message ?? `123erfasst HTTP ${res.status}`;
      throw new Error(message);
    }
    return body?.data;
  }

  // Best-effort — the exact shape of the `authProvider` query (and the client-credentials grant
  // it implies) is inferred from a partial public reference, not confirmed against a live tenant.
  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.token;
    const data = (await this.graphql(`query { authProvider { tokenEndpoint } }`)) as { authProvider?: { tokenEndpoint?: string } };
    const tokenEndpoint = data.authProvider?.tokenEndpoint;
    if (!tokenEndpoint) throw new Error("123erfasst did not return a tokenEndpoint from authProvider.");
    const res = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.creds.clientId, client_secret: this.creds.clientSecret }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error((body as { error?: string })?.error ?? `123erfasst token endpoint HTTP ${res.status}`);
    const { access_token, expires_in } = body as { access_token: string; expires_in?: number };
    if (!access_token) throw new Error("123erfasst token response did not include an access_token.");
    this.cachedToken = { token: access_token, expiresAt: Date.now() + (expires_in ?? 3600) * 1000 };
    return access_token;
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
    return [{ domain: "projects", tools: ["projects.search"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      // Query field names (`projects`, `id`/`name`) are a best-effort guess pending schema access.
      case "projects.search": {
        const token = await this.getAccessToken();
        const data = await this.graphql(`query { projects { id name } }`, undefined, token);
        return { data };
      }
      default:
        throw new Error(`123erfasst connector does not support tool '${tool}'.`);
    }
  }
}
