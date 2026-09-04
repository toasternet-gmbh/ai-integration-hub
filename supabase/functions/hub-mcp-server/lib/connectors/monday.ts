/**
 * monday.com connector ("monday sales CRM") — CRM. Auth: personal API v2 token in the
 * `Authorization` header with NO `Bearer` prefix (developer.monday.com/api-reference/docs/
 * authentication). A single GraphQL endpoint (`POST api.monday.com/v2`) for everything.
 *
 * Unlike HubSpot/Pipedrive, monday has no dedicated "contact"/"deal"/"company" object type — the
 * whole platform is generic boards/items/columns, and monday sales CRM is just monday's own
 * board-template convention on top of that (a "Deals" board, a "Contacts" board, an "Accounts"
 * board — with column ids for e.g. deal value/stage that are NOT standardized across accounts,
 * they're whatever the customer's own board setup uses). So this connector needs the relevant
 * board ids as extra credentials, and best-effort optional column ids for the couple of
 * canonical fields (deal amount/stage) that don't have a universal monday-side name the way
 * HubSpot's `dealstage`/`amount` properties do — if those aren't configured, deals.create still
 * works, it just can't set amount/stage. This is a materially fuzzier fit than the other CRM
 * connectors; verify column ids against the actual target account's board before relying on
 * amount/stage being set.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const ENDPOINT = "https://api.monday.com/v2";

export interface MondayCredentials {
  apiToken: string;
  dealsBoardId: string;
  contactsBoardId?: string;
  companiesBoardId?: string;
  dealAmountColumnId?: string;
  dealStageColumnId?: string;
}

interface MondayItem {
  id: string;
  name: string;
  column_values?: { id: string; text: string | null; value: string | null }[];
}

export class MondayConnector implements Connector {
  constructor(private creds: MondayCredentials) {}

  private async graphql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: this.creds.apiToken, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json().catch(() => null)) as { data?: unknown; errors?: { message: string }[] } | null;
    if (!res.ok || body?.errors?.length) {
      const message = body?.errors?.[0]?.message ?? `monday.com HTTP ${res.status}`;
      throw new Error(message);
    }
    return body?.data;
  }

  private requireBoard(boardId: string | undefined, label: string): string {
    if (!boardId) throw new Error(`This integration's credentials don't configure a ${label} — set it before using ${label}-related tools.`);
    return boardId;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.graphql("query { me { id } }");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "deals", tools: ["deals.search", "deals.get", "deals.create"] },
      { domain: "companies", tools: ["companies.search", "companies.get"] },
    ];
  }

  private async searchBoardItems(boardId: string, limit: number): Promise<unknown> {
    const data = (await this.graphql(
      `query ($boardId: ID!, $limit: Int!) { boards(ids: [$boardId]) { items_page(limit: $limit) { items { id name column_values { id text value } } } } }`,
      { boardId, limit },
    )) as { boards?: { items_page?: { items?: MondayItem[] } }[] };
    return data.boards?.[0]?.items_page?.items ?? [];
  }

  private async getItem(itemId: string): Promise<unknown> {
    const data = (await this.graphql(
      `query ($itemId: [ID!]) { items(ids: $itemId) { id name column_values { id text value } } }`,
      { itemId: [itemId] },
    )) as { items?: MondayItem[] };
    const item = data.items?.[0];
    if (!item) throw new Error(`monday.com item '${itemId}' not found.`);
    return item;
  }

  private async createItem(boardId: string, name: string, columnValues?: Record<string, unknown>): Promise<unknown> {
    const data = (await this.graphql(
      `mutation ($boardId: ID!, $name: String!, $columnValues: JSON) { create_item(board_id: $boardId, item_name: $name, column_values: $columnValues) { id name } }`,
      { boardId, name, columnValues: columnValues && Object.keys(columnValues).length > 0 ? JSON.stringify(columnValues) : undefined },
    )) as { create_item?: unknown };
    return data.create_item;
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      // monday's items_page supports column-value filter rules, but not a generic free-text
      // search across an unknown board's columns the way HubSpot/Pipedrive's dedicated
      // search endpoints do -- so email/name (contacts) and name (companies) filters are accepted
      // for input-schema conformance but not applied server-side; this returns the board's items
      // unfiltered, same posture as monday.com's own API surface for a generic board.
      case "contacts.search": {
        const boardId = this.requireBoard(this.creds.contactsBoardId, "contactsBoardId");
        const data = await this.searchBoardItems(boardId, Number(input.limit ?? 25));
        return { data };
      }
      case "contacts.get": {
        const contactId = String(input.contact_id ?? "");
        if (!contactId) throw new Error("contact_id is required.");
        const data = await this.getItem(contactId);
        return { data };
      }
      case "contacts.create": {
        const boardId = this.requireBoard(this.creds.contactsBoardId, "contactsBoardId");
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const data = await this.createItem(boardId, name);
        return { data };
      }
      case "deals.search": {
        const data = await this.searchBoardItems(this.creds.dealsBoardId, Number(input.limit ?? 25));
        return { data };
      }
      case "deals.get": {
        const dealId = String(input.deal_id ?? "");
        if (!dealId) throw new Error("deal_id is required.");
        const data = await this.getItem(dealId);
        return { data };
      }
      case "deals.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const columnValues: Record<string, unknown> = {};
        if (input.amount != null && this.creds.dealAmountColumnId) columnValues[this.creds.dealAmountColumnId] = input.amount;
        if (input.stage && this.creds.dealStageColumnId) columnValues[this.creds.dealStageColumnId] = { label: String(input.stage) };
        const data = await this.createItem(this.creds.dealsBoardId, name, columnValues);
        return { data };
      }
      case "companies.search": {
        const boardId = this.requireBoard(this.creds.companiesBoardId, "companiesBoardId");
        const data = await this.searchBoardItems(boardId, Number(input.limit ?? 25));
        return { data };
      }
      case "companies.get": {
        const companyId = String(input.company_id ?? "");
        if (!companyId) throw new Error("company_id is required.");
        const data = await this.getItem(companyId);
        return { data };
      }
      default:
        throw new Error(`monday.com connector does not support tool '${tool}'.`);
    }
  }
}
