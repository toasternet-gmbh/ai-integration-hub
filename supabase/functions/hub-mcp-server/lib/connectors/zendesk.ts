/**
 * Stub connector for Zendesk.
 * Requires actual vendor documentation and a sandbox account to implement real tools.
 */
import type { Capability, ConnectionResult, Connector, ToolResult } from "./types.ts";

export class ZendeskConnector implements Connector {
  private subdomain: string;
  private email: string;
  private apiToken: string;

  constructor(creds: { subdomain: string; email: string; apiToken: string }) {
    this.subdomain = creds.subdomain;
    this.email = creds.email;
    this.apiToken = creds.apiToken;
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.subdomain || !this.email || !this.apiToken) {
      return { ok: false, message: "Missing Subdomain, Email, or API Token" };
    }
    // Stub implementation
    return { ok: true, message: "Stub connector - no real connection made." };
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "companies", tools: ["companies.search", "companies.get"] },
      { domain: "tickets", tools: ["tickets.search", "tickets.get", "tickets.create"] },
    ];
  }

  async execute(tool: string, _input: Record<string, unknown>): Promise<ToolResult> {
    throw new Error(`Zendesk: ${tool} is implemented as a stub and cannot execute real calls yet.`);
  }
}
