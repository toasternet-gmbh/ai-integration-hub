/**
 * Contentful connector — CMS, via the Content Delivery API (read-only, cdn.contentful.com).
 * Auth: `Authorization: Bearer {accessToken}` with a per-space Content Delivery API access token
 * (Settings → API keys in Contentful). Scoped to one space + environment (defaults to "master").
 * Docs: contentful.com/developers/docs/references/content-delivery-api/.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface ContentfulCredentials {
  spaceId: string;
  accessToken: string;
  environmentId?: string;
}

export class ContentfulConnector implements Connector {
  constructor(private creds: ContentfulCredentials) {}

  private baseUrl(): string {
    const env = this.creds.environmentId?.trim() || "master";
    return `https://cdn.contentful.com/spaces/${encodeURIComponent(this.creds.spaceId)}/environments/${encodeURIComponent(env)}`;
  }

  private async request(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${this.creds.accessToken}`, Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `Contentful HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/entries?limit=1");
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
        if (input.search) params.set("query", String(input.search));
        params.set("limit", String(input.limit ?? 25));
        const data = await this.request(`/entries?${params.toString()}`);
        return { data };
      }
      case "cms.pages.get": {
        const pageId = String(input.page_id ?? "");
        if (!pageId) throw new Error("page_id is required.");
        const data = await this.request(`/entries/${encodeURIComponent(pageId)}`);
        return { data };
      }
      default:
        throw new Error(`Contentful connector does not support tool '${tool}'.`);
    }
  }
}
