/**
 * Stub connector for Notion.
 * Requires actual vendor documentation and a sandbox account to implement real tools.
 */
import type { Capability, ConnectionResult, Connector, ToolResult } from "./types.ts";

export class NotionConnector implements Connector {
  private apiToken: string;

  constructor(creds: { apiToken: string }) {
    this.apiToken = creds.apiToken;
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.apiToken) {
      return { ok: false, message: "Missing API Token" };
    }
    // Stub implementation
    return { ok: true, message: "Stub connector - no real connection made." };
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "cms.pages", tools: ["cms.pages.search", "cms.pages.get", "cms.pages.create", "cms.pages.update"] },
      { domain: "cms.posts", tools: ["cms.posts.search", "cms.posts.get", "cms.posts.create", "cms.posts.update"] },
      { domain: "projects", tools: ["projects.search", "projects.get", "projects.create"] },
    ];
  }

  async execute(tool: string, _input: Record<string, unknown>): Promise<ToolResult> {
    throw new Error(`Notion: ${tool} is implemented as a stub and cannot execute real calls yet.`);
  }
}
