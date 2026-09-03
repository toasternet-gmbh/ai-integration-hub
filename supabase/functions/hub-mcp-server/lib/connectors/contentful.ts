/**
 * Contentful connector — CMS. Reads go through the Content Delivery API (read-only,
 * cdn.contentful.com), auth `Authorization: Bearer {accessToken}` with a per-space Content
 * Delivery API access token (Settings → API keys in Contentful). Scoped to one space +
 * environment (defaults to "master"). Docs:
 * contentful.com/developers/docs/references/content-delivery-api/.
 *
 * Writes (cms.pages.create) go through the separate Content Management API
 * (api.contentful.com), which needs a genuinely different credential — a Personal Access Token or
 * OAuth token, NOT the Content Delivery API token above (confirmed: CDA tokens cannot call
 * api.contentful.com at all). `managementToken` is therefore optional on this connector's
 * credentials — an integration connected before write support existed, or one whose owner only
 * wants read access, simply omits it, and `getCapabilities()`/`cms.pages.create` reflect that.
 * Docs: contentful.com/developers/docs/references/content-management-api/.
 *
 * Unlike WordPress, Contentful has no fixed "page" content type — every space defines its own
 * content model, so creating an entry requires the caller to supply which content type
 * (`content_type_id`) and field values to use; there's no universal default to fall back to.
 * Field values are plain (not locale-wrapped) on the tool's input and wrapped under the
 * environment's default locale here — fetched via GET .../locales rather than hardcoded, since a
 * space's default locale isn't always "en-US".
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface ContentfulCredentials {
  spaceId: string;
  accessToken: string;
  environmentId?: string;
  managementToken?: string;
}

export class ContentfulConnector implements Connector {
  constructor(private creds: ContentfulCredentials) {}

  private environment(): string {
    return this.creds.environmentId?.trim() || "master";
  }

  private baseUrl(): string {
    return `https://cdn.contentful.com/spaces/${encodeURIComponent(this.creds.spaceId)}/environments/${encodeURIComponent(this.environment())}`;
  }

  private cmaBaseUrl(): string {
    return `https://api.contentful.com/spaces/${encodeURIComponent(this.creds.spaceId)}/environments/${encodeURIComponent(this.environment())}`;
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

  private async requestCma(path: string, init: RequestInit = {}): Promise<unknown> {
    if (!this.creds.managementToken) throw new Error("This Contentful integration has no Content Management API token configured -- writes aren't available.");
    const res = await fetch(`${this.cmaBaseUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.creds.managementToken}`, "Content-Type": "application/vnd.contentful.management.v1+json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `Contentful Management API HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  private async defaultLocale(): Promise<string> {
    try {
      const data = (await this.requestCma("/locales")) as { items?: { code: string; default?: boolean }[] };
      return data.items?.find((l) => l.default)?.code ?? data.items?.[0]?.code ?? "en-US";
    } catch {
      return "en-US";
    }
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
    const tools = ["cms.pages.search", "cms.pages.get", "cms.assets.search", "cms.assets.get"];
    if (this.creds.managementToken) tools.push("cms.pages.create", "cms.pages.update");
    return [{ domain: "cms", tools }];
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
      // Verified against Contentful's own Content Management API docs: POST /entries (with the
      // content type on the X-Contentful-Content-Type header) auto-generates the entry id and
      // creates it as a draft; publishing is a genuinely separate step (PUT .../published with the
      // entry's current X-Contentful-Version), which is why `publish` defaults to false here --
      // an agent should have to ask for "and publish it" explicitly, not get it for free.
      case "cms.pages.create": {
        const contentTypeId = String(input.content_type_id ?? "");
        const fields = input.fields as Record<string, unknown> | undefined;
        if (!contentTypeId || !fields || Object.keys(fields).length === 0) throw new Error("content_type_id and fields are required.");
        const locale = await this.defaultLocale();
        const localizedFields: Record<string, Record<string, unknown>> = {};
        for (const [fieldId, value] of Object.entries(fields)) localizedFields[fieldId] = { [locale]: value };
        const created = (await this.requestCma("/entries", {
          method: "POST",
          headers: { "X-Contentful-Content-Type": contentTypeId },
          body: JSON.stringify({ fields: localizedFields }),
        })) as { sys: { id: string; version: number } };
        if (!input.publish) return { data: created };
        const published = await this.requestCma(`/entries/${encodeURIComponent(created.sys.id)}/published`, {
          method: "PUT",
          headers: { "X-Contentful-Version": String(created.sys.version) },
        });
        return { data: published };
      }
      // Verified against Contentful's own CMA docs: fetch the entry via the Management API (needed
      // for its current sys.version, required on every PUT for optimistic locking), merge in only
      // the fields the caller supplied under the resolved locale, PUT it back. Same "publish is a
      // separate explicit step" posture as cms.pages.create.
      case "cms.pages.update": {
        const pageId = String(input.page_id ?? "");
        const fields = input.fields as Record<string, unknown> | undefined;
        if (!pageId) throw new Error("page_id is required.");
        if (!fields || Object.keys(fields).length === 0) throw new Error("fields is required.");
        const existing = (await this.requestCma(`/entries/${encodeURIComponent(pageId)}`)) as {
          sys: { version: number }; fields?: Record<string, Record<string, unknown>>;
        };
        const locale = await this.defaultLocale();
        const mergedFields = { ...(existing.fields ?? {}) };
        for (const [fieldId, value] of Object.entries(fields)) mergedFields[fieldId] = { ...(mergedFields[fieldId] ?? {}), [locale]: value };
        const updated = (await this.requestCma(`/entries/${encodeURIComponent(pageId)}`, {
          method: "PUT",
          headers: { "X-Contentful-Version": String(existing.sys.version) },
          body: JSON.stringify({ fields: mergedFields }),
        })) as { sys: { id: string; version: number } };
        if (!input.publish) return { data: updated };
        const published = await this.requestCma(`/entries/${encodeURIComponent(pageId)}/published`, {
          method: "PUT",
          headers: { "X-Contentful-Version": String(updated.sys.version) },
        });
        return { data: published };
      }
      // Assets (images/files) are a distinct Contentful object from entries -- read via the same
      // Content Delivery API already used for cms.pages.search/get, no management token needed.
      case "cms.assets.search": {
        const params = new URLSearchParams();
        if (input.search) params.set("query", String(input.search));
        params.set("limit", String(input.limit ?? 25));
        const data = await this.request(`/assets?${params.toString()}`);
        return { data };
      }
      case "cms.assets.get": {
        const assetId = String(input.asset_id ?? "");
        if (!assetId) throw new Error("asset_id is required.");
        const data = await this.request(`/assets/${encodeURIComponent(assetId)}`);
        return { data };
      }
      default:
        throw new Error(`Contentful connector does not support tool '${tool}'.`);
    }
  }
}
