/**
 * Stub connector for QuickBooks Online.
 * Requires actual vendor documentation and a sandbox account to implement real tools.
 */
import type { Capability, ConnectionResult, Connector, ToolResult } from "./types.ts";

export class QuickBooksConnector implements Connector {
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
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create", "contacts.update", "contacts.addresses.search", "contacts.addresses.create"] },
      { domain: "invoices", tools: ["invoices.search", "invoices.get", "invoices.create", "invoices.finalize", "invoices.record_payment", "invoices.void"] },
      { domain: "credit_notes", tools: ["credit_notes.search", "credit_notes.get", "credit_notes.create"] },
      { domain: "vouchers", tools: ["vouchers.create_from_file"] },
    ];
  }

  async execute(tool: string, _input: Record<string, unknown>): Promise<ToolResult> {
    throw new Error(`QuickBooks: ${tool} is implemented as a stub and cannot execute real calls yet.`);
  }
}
