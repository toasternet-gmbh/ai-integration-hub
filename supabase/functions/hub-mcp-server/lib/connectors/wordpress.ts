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

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: this.authHeader(), "Content-Type": "application/json", Accept: "application/json" },
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
    return [{ domain: "cms", tools: ["cms.pages.search", "cms.pages.get", "cms.posts.search", "cms.posts.get", "cms.posts.create", "cms.posts.update"] }];
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
      // /wp-json/wp/v2/posts is a real, confirmed WordPress core resource, distinct from /pages
      // (blog posts vs. static pages) but with the same shape and the same Application Password
      // auth already used for reads.
      case "cms.posts.search": {
        const params = new URLSearchParams();
        if (input.search) params.set("search", String(input.search));
        if (input.status) params.set("status", String(input.status));
        params.set("per_page", String(input.limit ?? 25));
        const data = await this.request(`/posts?${params.toString()}`);
        return { data };
      }
      case "cms.posts.get": {
        const postId = String(input.post_id ?? "");
        if (!postId) throw new Error("post_id is required.");
        const data = await this.request(`/posts/${encodeURIComponent(postId)}`);
        return { data };
      }
      case "cms.posts.create": {
        const title = String(input.title ?? "");
        const content = String(input.content ?? "");
        if (!title || !content) throw new Error("title and content are required.");
        const data = await this.request("/posts", {
          method: "POST",
          body: JSON.stringify({ title, content, status: input.status ? String(input.status) : "draft" }),
        });
        return { data };
      }
      case "cms.posts.update": {
        const postId = String(input.post_id ?? "");
        if (!postId) throw new Error("post_id is required.");
        const body: Record<string, unknown> = {};
        if (input.title != null) body.title = String(input.title);
        if (input.content != null) body.content = String(input.content);
        if (input.status != null) body.status = String(input.status);
        const data = await this.request(`/posts/${encodeURIComponent(postId)}`, { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      default:
        throw new Error(`WordPress connector does not support tool '${tool}'.`);
    }
  }
}
