/**
 * Personio connector — time tracking (Personio's Attendance API covers time entries). Auth is
 * OAuth2 client-credentials: a `client_id`/`client_secret` pair (created in Personio under
 * Marketplace → Connected integrations → "Create custom integration") is exchanged for a bearer
 * access token via POST /v2/auth/token. Docs: developer.personio.de.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface PersonioCredentials {
  clientId: string;
  clientSecret: string;
}

export class PersonioConnector implements Connector {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private creds: PersonioCredentials) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.token;

    const res = await fetch("https://api.personio.de/v2/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.creds.clientId, client_secret: this.creds.clientSecret }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error_description?: string; error?: string })?.error_description
        ?? (body as { error?: string })?.error
        ?? `Personio HTTP ${res.status}`;
      throw new Error(message);
    }
    const { access_token, expires_in } = body as { access_token: string; expires_in?: number };
    if (!access_token) throw new Error("Personio token response did not include an access_token.");
    this.cachedToken = { token: access_token, expiresAt: Date.now() + (expires_in ?? 3600) * 1000 };
    return access_token;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://api.personio.de/v2${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    if (res.status === 204) {
      if (!res.ok) throw new Error(`Personio HTTP ${res.status}`);
      return null;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: { message?: string } })?.error?.message ?? `Personio HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      // Requesting an access token is itself the cheapest possible probe — it fails immediately
      // on a bad client_id/secret pair, before any resource endpoint is even called.
      await this.getAccessToken();
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
        const data = await this.request(`/attendance-periods${qs ? `?${qs}` : ""}`);
        return { data };
      }
      case "time_entries.get": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const data = await this.request(`/attendance-periods/${encodeURIComponent(entryId)}`);
        return { data };
      }
      // POST /v2/attendance-periods is real and confirmed (developer.personio.de). Unlike Toggl/
      // Clockify, Personio is an HR attendance ledger, not a stopwatch: there's no running-timer
      // concept, so end_time is required here, and every period belongs to a specific employee
      // (`person.id`, not the API token) rather than "whoever's token this is." Deliberately does
      // NOT pass `skip_approval=true` -- Personio's own approval workflow still applies after the
      // Hub's own approval gate, the same "belt and suspenders" posture as the conservative
      // draft-by-default choices elsewhere (WordPress posts, Lexoffice invoices).
      case "time_entries.create": {
        const employeeId = String(input.employee_id ?? "");
        const startTime = String(input.start_time ?? "");
        const endTime = String(input.end_time ?? "");
        if (!employeeId) throw new Error("employee_id is required.");
        if (!startTime || !endTime) throw new Error("start_time and end_time are required (Personio has no running-timer concept).");
        const body = {
          person: { id: Number(employeeId) },
          type: "WORK",
          start: { date_time: startTime },
          end: { date_time: endTime },
          ...(input.description ? { comment: String(input.description) } : {}),
        };
        const data = await this.request("/attendance-periods", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      // PATCH /v2/attendance-periods/{id} is real and confirmed. Personio enforces its own
      // per-day update-limit and can cascade into other periods (returned as `affected_periods`)
      // -- both surface as whatever error/response Personio itself returns, not specially handled.
      case "time_entries.update": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const body: Record<string, unknown> = {};
        if (input.start_time != null) body.start = { date_time: String(input.start_time) };
        if (input.end_time != null) body.end = { date_time: String(input.end_time) };
        if (input.description != null) body.comment = String(input.description);
        const data = await this.request(`/attendance-periods/${encodeURIComponent(entryId)}`, { method: "PATCH", body: JSON.stringify(body) });
        return { data };
      }
      case "time_entries.delete": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        await this.request(`/attendance-periods/${encodeURIComponent(entryId)}`, { method: "DELETE" });
        return { data: { time_entry_id: entryId, deleted: true } };
      }
      default:
        throw new Error(`Personio connector does not support tool '${tool}'.`);
    }
  }
}
