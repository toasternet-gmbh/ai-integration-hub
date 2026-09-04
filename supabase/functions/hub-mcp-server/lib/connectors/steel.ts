/**
 * Steel.dev connector — automation, a second platform in the same category and tool domain as
 * Browserless (lib/connectors/browserless.ts) — same architectural call for the same reason: its
 * primary SDK pattern is session-based (create a session, then drive it over CDP with
 * Puppeteer/Playwright), which doesn't fit the Deno edge runtime any better than Browserless's
 * CDP path would, but it also documents plain one-shot REST endpoints
 * (docs.steel.dev/overview/scrape-api, .../screenshot) that sidestep that entirely — same
 * approach as browserless.ts. Auth: `steel-api-key` header (dashboard-issued, per-account, not
 * Hub-wide). Base: `https://api.steel.dev` (fixed, unlike Browserless's region-specific hosts).
 *
 * Narrower tool coverage than Browserless: only `browser.get_content` (via `/v1/scrape` with
 * `format: ["html"]` — Steel's scrape endpoint converts a whole page to a chosen format, it
 * doesn't do Browserless-style per-CSS-selector structured extraction as far as could be
 * confirmed) and `browser.screenshot` (via `/v1/screenshot`) are implemented — no `browser.scrape`
 * or `browser.pdf`, since no one-shot REST endpoint for either could be confirmed to exist on this
 * API. Every call still runs its `url` through `assertPublicHttpUrl` before dispatching, same
 * non-negotiable rule as every other tool in this domain.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";
import { assertPublicHttpUrl } from "../urlGuard.ts";

const BASE = "https://api.steel.dev";

export interface SteelCredentials {
  apiKey: string;
}

function base64Encode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export class SteelConnector implements Connector {
  constructor(private creds: SteelCredentials) {}

  private async requestJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "steel-api-key": this.creds.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Steel.dev HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "";
    return contentType.includes("application/json") ? JSON.parse(text) : text;
  }

  private async requestBinary(path: string, body: Record<string, unknown>): Promise<{ base64: string; contentType: string }> {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "steel-api-key": this.creds.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Steel.dev HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await res.arrayBuffer();
    return { base64: base64Encode(buffer), contentType };
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.requestJson("/v1/scrape", { url: "https://example.com", format: ["html"] });
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [{ domain: "browser", tools: ["browser.get_content", "browser.screenshot"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    const url = String(input.url ?? "");
    if (!url) throw new Error("url is required.");
    assertPublicHttpUrl(url, "url");

    switch (tool) {
      case "browser.get_content": {
        const data = (await this.requestJson("/v1/scrape", { url, format: ["html"] })) as { content?: { html?: string } };
        return { data: { html: data.content?.html ?? data } };
      }
      case "browser.screenshot": {
        const { base64, contentType } = await this.requestBinary("/v1/screenshot", { url, fullPage: Boolean(input.full_page) });
        return { data: { image_base64: base64, content_type: contentType } };
      }
      default:
        throw new Error(`Steel.dev connector does not support tool '${tool}'.`);
    }
  }
}
