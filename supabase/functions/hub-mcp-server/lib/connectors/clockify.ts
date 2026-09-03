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

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...init.headers, "X-Api-Key": this.creds.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    });
    if (res.status === 204) {
      if (!res.ok) throw new Error(`Clockify HTTP ${res.status}`);
      return null;
    }
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
    return [{ domain: "time_entries", tools: ["time_entries.search", "time_entries.get", "time_entries.create", "time_entries.update", "time_entries.delete"] }];
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
      // POST /workspaces/{id}/time-entries is real and confirmed (docs.clockify.me). Omitting
      // `end` creates a running (in-progress) entry -- Clockify has no separate "start timer"
      // endpoint either, same posture as Toggl.
      case "time_entries.create": {
        const startTime = String(input.start_time ?? "");
        if (!startTime) throw new Error("start_time is required.");
        const body: Record<string, unknown> = {
          start: new Date(Date.parse(startTime)).toISOString(),
          description: input.description ? String(input.description) : undefined,
          projectId: input.project_id ? String(input.project_id) : undefined,
        };
        if (input.end_time) body.end = new Date(Date.parse(String(input.end_time))).toISOString();
        const data = await this.request(`/workspaces/${encodeURIComponent(this.creds.workspaceId)}/time-entries`, { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      // PUT replaces the entry rather than patching it (per Clockify's docs) -- the existing entry
      // is fetched first and merged so fields the caller didn't mention aren't wiped out. Setting
      // `end` on an entry that was created running is how a running timer gets stopped -- there's
      // no separate stop endpoint needed either.
      case "time_entries.update": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const existing = (await this.request(`/workspaces/${encodeURIComponent(this.creds.workspaceId)}/time-entries/${encodeURIComponent(entryId)}`)) as {
          timeInterval?: { start?: string; end?: string }; description?: string; projectId?: string;
        };
        const body: Record<string, unknown> = {
          start: input.start_time ? new Date(Date.parse(String(input.start_time))).toISOString() : existing.timeInterval?.start,
          end: input.end_time ? new Date(Date.parse(String(input.end_time))).toISOString() : existing.timeInterval?.end,
          description: input.description != null ? String(input.description) : existing.description,
          projectId: input.project_id != null ? String(input.project_id) : existing.projectId,
        };
        const data = await this.request(`/workspaces/${encodeURIComponent(this.creds.workspaceId)}/time-entries/${encodeURIComponent(entryId)}`, { method: "PUT", body: JSON.stringify(body) });
        return { data };
      }
      case "time_entries.delete": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        await this.request(`/workspaces/${encodeURIComponent(this.creds.workspaceId)}/time-entries/${encodeURIComponent(entryId)}`, { method: "DELETE" });
        return { data: { time_entry_id: entryId, deleted: true } };
      }
      default:
        throw new Error(`Clockify connector does not support tool '${tool}'.`);
    }
  }
}
