/**
 * Clockify connector — time tracking. Auth: `X-Api-Key: {apiKey}` (Profile settings → API key).
 * Time entries are scoped to a workspace + user, so both a `workspaceId` and the token owner's
 * user id are needed — the user id isn't asked for at connect time, it's resolved from `/user`
 * (the "get current user" endpoint) on first use. Docs: docs.clockify.me.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const BASE = "https://api.clockify.me/api/v1";

export interface ClockifyCredentials {
  workspaceId: string;
  apiKey: string;
}

export class ClockifyConnector implements Connector {
  private cachedUserId: string | null = null;

  constructor(private creds: ClockifyCredentials) {}

  private async request(path: string): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-Api-Key": this.creds.apiKey, Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `Clockify HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  private async getUserId(): Promise<string> {
    if (this.cachedUserId) return this.cachedUserId;
    const user = (await this.request("/user")) as { id?: string };
    if (!user.id) throw new Error("Clockify /user response did not include an id.");
    this.cachedUserId = user.id;
    return user.id;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const workspaces = (await this.request("/workspaces")) as Array<{ id: string }>;
      if (!workspaces.some((w) => w.id === this.creds.workspaceId)) {
        return { ok: false, message: `workspaceId '${this.creds.workspaceId}' was not found among this API key's Clockify workspaces.` };
      }
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [{ domain: "time_entries", tools: ["time_entries.search", "time_entries.get"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "time_entries.search": {
        const userId = await this.getUserId();
        const params = new URLSearchParams();
        if (input.start_date) params.set("start", String(input.start_date));
        if (input.end_date) params.set("end", String(input.end_date));
        const qs = params.toString();
        const data = await this.request(`/workspaces/${encodeURIComponent(this.creds.workspaceId)}/user/${encodeURIComponent(userId)}/time-entries${qs ? `?${qs}` : ""}`);
        return { data };
      }
      case "time_entries.get": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const data = await this.request(`/workspaces/${encodeURIComponent(this.creds.workspaceId)}/time-entries/${encodeURIComponent(entryId)}`);
        return { data };
      }
      default:
        throw new Error(`Clockify connector does not support tool '${tool}'.`);
    }
  }
}
