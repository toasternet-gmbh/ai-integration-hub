/**
 * Browserless connector — automation (hosted headless-Chrome REST API). Unlike every other
 * connector, this doesn't talk to "the customer's own business system" — it's a generic
 * remote-browser capability that can be pointed at any URL the caller supplies, which is why
 * every tool call below runs the target URL through `assertPublicHttpUrl` (lib/urlGuard.ts)
 * BEFORE dispatching, not just at connector-creation time the way storeUrl/siteUrl connectors do.
 * That check is a real but PARTIAL mitigation, not a complete one (see urlGuard.ts's own header):
 * it pattern-matches literal IPs/hostnames with no DNS resolution, so a domain whose A-record
 * points at a private/metadata address isn't caught — and the actual fetch of `url` happens on
 * Browserless's own infrastructure, not this Hub's, so even a perfect Hub-side check wouldn't be
 * the real backstop against Browserless's own network being reachable from wherever it runs. Ship
 * this without overstating what it protects against.
 *
 * Deliberately uses Browserless's plain, stateless REST endpoints (`/content`, `/screenshot`,
 * `/scrape`, `/pdf` — one request launches a browser, does one thing, closes it) rather than its
 * CDP WebSocket + a persistent Puppeteer/Playwright driver session: Supabase's Deno edge runtime
 * has no good story for holding a long-lived browser-automation-library connection open across a
 * single request/response cycle, and the REST surface sidesteps that entirely. Auth: an API token
 * as a `?token=` query param (dashboard-issued, per-account, not Hub-wide). `endpoint` is the
 * region/self-hosted host assigned at signup — defaults to Browserless's SFO region if unset, but
 * confirm the account's actual assigned endpoint before relying on that default.
 * Docs: docs.browserless.io/rest-apis/intro.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";
import { assertPublicHttpUrl } from "../urlGuard.ts";
import { bytesToBase64 } from "../base64.ts";

export interface BrowserlessCredentials {
  apiKey: string;
  endpoint?: string;
}

export class BrowserlessConnector implements Connector {
  constructor(private creds: BrowserlessCredentials) {}

  private get base(): string {
    return this.creds.endpoint ?? "https://production-sfo.browserless.io";
  }

  private async requestJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.base}${path}?token=${encodeURIComponent(this.creds.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Browserless HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "";
    return contentType.includes("application/json") ? JSON.parse(text) : text;
  }

  private async requestBinary(path: string, body: Record<string, unknown>): Promise<{ base64: string; contentType: string }> {
    const res = await fetch(`${this.base}${path}?token=${encodeURIComponent(this.creds.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Browserless HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await res.arrayBuffer();
    return { base64: bytesToBase64(buffer), contentType };
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.requestJson("/content", { url: "https://example.com" });
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [{ domain: "browser", tools: ["browser.get_content", "browser.screenshot", "browser.scrape", "browser.pdf"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    const url = String(input.url ?? "");
    if (!url) throw new Error("url is required.");
    assertPublicHttpUrl(url, "url");

    switch (tool) {
      case "browser.get_content": {
        const data = await this.requestJson("/content", { url });
        return { data: { html: data } };
      }
      case "browser.screenshot": {
        const { base64, contentType } = await this.requestBinary("/screenshot", {
          url,
          options: { type: "png", fullPage: Boolean(input.full_page) },
        });
        return { data: { image_base64: base64, content_type: contentType } };
      }
      case "browser.scrape": {
        const selectors = Array.isArray(input.selectors) ? input.selectors.map(String) : [];
        if (selectors.length === 0) throw new Error("selectors is required.");
        const data = await this.requestJson("/scrape", { url, elements: selectors.map((selector) => ({ selector })) });
        return { data };
      }
      case "browser.pdf": {
        const { base64, contentType } = await this.requestBinary("/pdf", { url });
        return { data: { pdf_base64: base64, content_type: contentType } };
      }
      default:
        throw new Error(`Browserless connector does not support tool '${tool}'.`);
    }
  }
}
