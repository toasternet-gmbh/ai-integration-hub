/**
 * GoCardless Bank Account Data connector — banking, read-only (accounts.list, transactions.search
 * only; no payment initiation, deliberately out of scope — see tools/banking.ts). Unlike every
 * other connector, credentials here don't authenticate the connector itself (that's the Hub-wide
 * GOCARDLESS_SECRET_ID/KEY in lib/gocardless.ts) — they just identify which bank accounts this
 * integration's end-user consented to, established via the requisition flow in tools/banking.ts.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";
import { getAccountBalances, getAccountDetails, getAccountTransactions } from "../gocardless.ts";

export interface GoCardlessCredentials {
  requisitionId: string;
  accountIds: string[];
}

export class GoCardlessConnector implements Connector {
  constructor(private creds: GoCardlessCredentials) {}

  async testConnection(): Promise<ConnectionResult> {
    if (!this.creds.accountIds?.length) {
      return { ok: false, message: "No linked accounts — consent flow not completed yet." };
    }
    try {
      await getAccountDetails(this.creds.accountIds[0]);
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [{ domain: "accounts", tools: ["accounts.list"] }, { domain: "transactions", tools: ["transactions.search"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "accounts.list": {
        const data = await Promise.all(this.creds.accountIds.map(async (accountId) => {
          const [details, balances] = await Promise.all([getAccountDetails(accountId), getAccountBalances(accountId)]);
          return { account_id: accountId, details, balances };
        }));
        return { data };
      }
      case "transactions.search": {
        const accountId = String(input.account_id ?? this.creds.accountIds[0] ?? "");
        if (!accountId) throw new Error("account_id is required (no linked accounts to default to).");
        if (!this.creds.accountIds.includes(accountId)) throw new Error(`Account ${accountId} is not linked to this integration.`);
        const data = await getAccountTransactions(accountId, {
          dateFrom: input.date_from ? String(input.date_from) : undefined,
          dateTo: input.date_to ? String(input.date_to) : undefined,
        });
        return { data };
      }
      default:
        throw new Error(`GoCardless connector does not support tool '${tool}'.`);
    }
  }
}
