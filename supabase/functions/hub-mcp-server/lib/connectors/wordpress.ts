/**
 * WordPress connector — CMS. Auth via an Application Password (WordPress core since 5.6): a
 * per-user credential sent as HTTP Basic, not the user's real login password.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface WordPressCredentials {
  siteUrl: string; // e.g. "https://myblog.com" (no trailing slash)
  username: string;
  appPassword: string;
}

export class WordPressConnector implements Connector {
  constructor(private creds: WordPressCredentials) {}

  private baseUrl(): string {
    return `${this.creds.siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2`;
  }

  private authHeader(): string {
    return "Basic " + btoa(`${this.creds.username}:${this.creds.appPassword}`);
  }

  private async request(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      headers: { Authorization: this.authHeader(), Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `WordPress HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      // /users/me needs valid auth and has no side effects — confirms both reachability and creds.
      await this.request("/users/me");
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
        if (input.status) params.set("status", String(input.status));
        params.set("per_page", String(input.limit ?? 25));
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
        throw new Error(`WordPress connector does not support tool '${tool}'.`);
    }
  }
}
