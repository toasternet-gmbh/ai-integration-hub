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

  private async request(path: string): Promise<unknown> {
    const res = await fetch(`https://api.track.toggl.com/api/v9${path}`, {
      headers: { Authorization: this.authHeader(), Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `Toggl HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
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
    return [{ domain: "time_entries", tools: ["time_entries.search", "time_entries.get"] }];
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
      default:
        throw new Error(`Toggl connector does not support tool '${tool}'.`);
    }
  }
}
