/**
 * Stub connector for Jira.
 * Requires actual vendor documentation and a sandbox account to implement real tools.
 */
import type { Capability, ConnectionResult, Connector, ToolResult } from "./types.ts";

export class JiraConnector implements Connector {
  private domain: string;
  private email: string;
  private apiToken: string;

  constructor(creds: { domain: string; email: string; apiToken: string }) {
    this.domain = creds.domain;
    this.email = creds.email;
    this.apiToken = creds.apiToken;
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.domain || !this.email || !this.apiToken) {
      return { ok: false, message: "Missing Domain, Email, or API Token" };
    }
    // Stub implementation
    return { ok: true, message: "Stub connector - no real connection made." };
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "projects", tools: ["projects.search", "projects.get", "projects.create"] },
      { domain: "tickets", tools: ["tickets.search", "tickets.get", "tickets.create"] },
      { domain: "employees", tools: ["employees.search", "employees.get"] },
    ];
  }

  async execute(tool: string, _input: Record<string, unknown>): Promise<ToolResult> {
    throw new Error(`Jira: ${tool} is implemented as a stub and cannot execute real calls yet.`);
  }
}
