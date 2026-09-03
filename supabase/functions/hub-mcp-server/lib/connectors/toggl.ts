/**
 * Toggl Track connector — time tracking. Auth via a personal API token, sent as HTTP Basic with
 * the token as username and the literal string "api_token" as password (Toggl's convention).
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface TogglCredentials {
  apiToken: string;
}

export class TogglConnector implements Connector {
  constructor(private creds: TogglCredentials) {}

  private authHeader(): string {
    return "Basic " + btoa(`${this.creds.apiToken}:api_token`);
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`https://api.track.toggl.com/api/v9${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: this.authHeader(), "Content-Type": "application/json", Accept: "application/json" },
    });
    if (res.status === 204 || res.headers.get("content-length") === "0") {
      if (!res.ok) throw new Error(`Toggl HTTP ${res.status}`);
      return null;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `Toggl HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  /** A time entry's workspace isn't necessarily the token owner's default one — reads it off the
   *  entry itself rather than assuming, for update/delete. */
  private async findEntryWorkspaceId(entryId: string): Promise<number> {
    const entry = (await this.request(`/me/time_entries/${encodeURIComponent(entryId)}`)) as { workspace_id?: number };
    if (!entry?.workspace_id) throw new Error(`Time entry ${entryId} not found.`);
    return entry.workspace_id;
  }

  private async defaultWorkspaceId(): Promise<number> {
    const me = (await this.request("/me")) as { default_workspace_id?: number };
    if (!me?.default_workspace_id) throw new Error("Could not resolve a default Toggl workspace for this token.");
    return me.default_workspace_id;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      // /me needs only a valid token and has no side effects — cheapest possible probe.
      await this.request("/me");
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
        const params = new URLSearchParams();
        if (input.start_date) params.set("start_date", String(input.start_date));
        if (input.end_date) params.set("end_date", String(input.end_date));
        const qs = params.toString();
        const data = await this.request(`/me/time_entries${qs ? `?${qs}` : ""}`);
        return { data };
      }
      case "time_entries.get": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const data = await this.request(`/me/time_entries/${encodeURIComponent(entryId)}`);
        return { data };
      }
      // POST /workspaces/{id}/time_entries is real and confirmed (Toggl's own community API
      // reference). A running timer (no end_time) is Toggl's own sentinel convention: `duration`
      // set to the negative of the start-epoch-seconds, no `stop` field -- there's no separate
      // "start timer" endpoint in v9 (that only existed in the retired v8 API). `created_with` is
      // a required field identifying the calling app.
      case "time_entries.create": {
        const startTime = String(input.start_time ?? "");
        if (!startTime) throw new Error("start_time is required.");
        const workspaceId = await this.defaultWorkspaceId();
        const startMs = Date.parse(startTime);
        const body: Record<string, unknown> = {
          workspace_id: workspaceId,
          created_with: "AI Integration Hub",
          start: new Date(startMs).toISOString(),
          description: input.description ? String(input.description) : undefined,
          project_id: input.project_id ? Number(input.project_id) : undefined,
        };
        if (input.end_time) {
          const endMs = Date.parse(String(input.end_time));
          body.stop = new Date(endMs).toISOString();
          body.duration = Math.round((endMs - startMs) / 1000);
        } else {
          body.duration = -Math.round(startMs / 1000);
        }
        const data = await this.request(`/workspaces/${workspaceId}/time_entries`, { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "time_entries.update": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const workspaceId = await this.findEntryWorkspaceId(entryId);
        const body: Record<string, unknown> = {};
        if (input.description != null) body.description = String(input.description);
        if (input.project_id != null) body.project_id = Number(input.project_id);
        if (input.start_time != null) body.start = new Date(Date.parse(String(input.start_time))).toISOString();
        if (input.end_time != null) {
          const startMs = input.start_time ? Date.parse(String(input.start_time)) : Date.parse(String(body.start ?? ""));
          const endMs = Date.parse(String(input.end_time));
          body.stop = new Date(endMs).toISOString();
          body.duration = Math.round((endMs - startMs) / 1000);
        }
        const data = await this.request(`/workspaces/${workspaceId}/time_entries/${encodeURIComponent(entryId)}`, { method: "PUT", body: JSON.stringify(body) });
        return { data };
      }
      case "time_entries.delete": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const workspaceId = await this.findEntryWorkspaceId(entryId);
        await this.request(`/workspaces/${workspaceId}/time_entries/${encodeURIComponent(entryId)}`, { method: "DELETE" });
        return { data: { time_entry_id: entryId, deleted: true } };
      }
      default:
        throw new Error(`Toggl connector does not support tool '${tool}'.`);
    }
  }
}
