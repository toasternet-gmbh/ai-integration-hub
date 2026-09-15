/**
 * Stub connector for Odoo ERP.
 * Requires actual vendor documentation and a sandbox account to implement real tools.
 */
import type { Capability, ConnectionResult, Connector, ToolResult } from "./types.ts";

export class OdooConnector implements Connector {
  private url: string;
  private apiKey: string;

  constructor(creds: { url: string; db?: string; username?: string; apiKey: string }) {
    this.url = creds.url;
    this.apiKey = creds.apiKey;
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.url || !this.apiKey) {
      return { ok: false, message: "Missing URL or API Key" };
    }
    // Stub implementation
    return { ok: true, message: "Stub connector - no real connection made." };
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create", "contacts.update", "contacts.addresses.search", "contacts.addresses.create"] },
      { domain: "invoices", tools: ["invoices.search", "invoices.get", "invoices.create", "invoices.finalize", "invoices.record_payment", "invoices.void"] },
      { domain: "products", tools: ["products.search", "products.get", "products.create"] },
      { domain: "orders", tools: ["orders.search", "orders.get", "orders.create"] },
    ];
  }

  async execute(tool: string, _input: Record<string, unknown>): Promise<ToolResult> {
    throw new Error(`Odoo: ${tool} is implemented as a stub and cannot execute real calls yet.`);
  }
}
