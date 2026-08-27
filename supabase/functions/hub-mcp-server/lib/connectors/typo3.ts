/**
 * TYPO3 connector — CMS. BEST-EFFORT / LOW CONFIDENCE: unlike WordPress, TYPO3 core ships no
 * built-in inbound REST API for reading page content — confirmed against TYPO3's own core-api
 * docs, which only describe outbound HTTP requests (via Guzzle), not an inbound content API.
 * Reading pages from an arbitrary TYPO3 site therefore requires that site to have a community REST
 * extension installed — this connector targets the shape of the widely-used `cundd/rest`
 * extension's default `pages` endpoint, authenticated with a bearer token. If the target site uses
 * a different REST extension (or none), connecting will fail — this is not a universal "connect
 * any TYPO3 site" story the way wordpress.ts is for WordPress.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface Typo3Credentials {
  siteUrl: string; // e.g. "https://mysite.example.com" (no trailing slash)
  accessToken: string;
}

export class Typo3Connector implements Connector {
  constructor(private creds: Typo3Credentials) {}

  private baseUrl(): string {
    return `${this.creds.siteUrl.replace(/\/+$/, "")}/rest`;
  }

  private async request(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${this.creds.accessToken}`, Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `TYPO3 HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      // /pages?limit=1 needs only a valid token and has no side effects — cheapest possible probe.
      await this.request("/pages?limit=1");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [{ domain: "cms", tools: ["cms.pages.search", "cms.pages.get"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "cms.pages.search": {
        const params = new URLSearchParams();
        if (input.search) params.set("search", String(input.search));
        params.set("limit", String(input.limit ?? 25));
        const data = await this.request(`/pages?${params.toString()}`);
        return { data };
      }
      case "cms.pages.get": {
        const pageId = String(input.page_id ?? "");
        if (!pageId) throw new Error("page_id is required.");
        const data = await this.request(`/pages/${encodeURIComponent(pageId)}`);
        return { data };
      }
      default:
        throw new Error(`TYPO3 connector does not support tool '${tool}'.`);
    }
  }
}
