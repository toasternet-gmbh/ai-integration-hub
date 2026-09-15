/**
 * Stub connector for Salesforce CRM.
 * Requires actual vendor documentation and a sandbox account to implement real tools.
 */
import type { Capability, ConnectionResult, Connector, ToolResult } from "./types.ts";

export class SalesforceConnector implements Connector {
  private instanceUrl: string;
  private apiToken: string;

  constructor(creds: { instanceUrl: string; apiToken: string }) {
    this.instanceUrl = creds.instanceUrl;
    this.apiToken = creds.apiToken;
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.instanceUrl || !this.apiToken) {
      return { ok: false, message: "Missing Instance URL or API Token" };
    }
    // Stub implementation
    return { ok: true, message: "Stub connector - no real connection made." };
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "deals", tools: ["deals.search", "deals.get", "deals.create"] },
      { domain: "companies", tools: ["companies.search", "companies.get"] },
      { domain: "tickets", tools: ["tickets.search", "tickets.get", "tickets.create"] },
      { domain: "owners", tools: ["owners.search"] },
      { domain: "associations", tools: ["associations.list", "associations.create"] },
    ];
  }

  async execute(tool: string, _input: Record<string, unknown>): Promise<ToolResult> {
    throw new Error(`Salesforce: ${tool} is implemented as a stub and cannot execute real calls yet.`);
  }
}
