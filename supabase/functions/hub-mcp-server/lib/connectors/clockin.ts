/**
 * clockin connector — time tracking (German, craft/trades-focused: "Handwerker App"). Auth:
 * `Authorization: Bearer {apiToken}` (generated under Settings → Interfaces → clockin API in the
 * office center). Base: `https://customerapi.clockin.de/v3` (docs.clockin.de/customer-api/v3).
 *
 * Public documentation for this API is thinner than the other time-tracking connectors — only a
 * handful of endpoints are independently confirmed (via clockin's own support FAQ, not the full
 * interactive docs, which are behind a login): `GET /workdays/search`, `POST /events`,
 * `GET /projects`, `GET /projects/search`. Query-param and request-body field names below are
 * best-effort (workdays/events are clockin's own vocabulary for what this Hub calls time entries)
 * and NOT independently spec-verified the way e.g. sevDesk's endpoints were — confirm against a
 * live account (or a logged-in look at docs.clockin.de/customer-api/v3) before enabling this
 * platform for real customers. Deliberately narrow tool coverage for the same reason: only what's
 * confirmed to exist is implemented — no time_entries.get / update / delete / report, and no
 * clients or tags tools (unconfirmed whether clockin's API exposes clients/tags as distinct
 * objects at all).
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const BASE = "https://customerapi.clockin.de/v3";

export interface ClockinCredentials {
  apiToken: string;
}

export class ClockinConnector implements Connector {
  constructor(private creds: ClockinCredentials) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.creds.apiToken}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { message?: string })?.message ?? `clockin HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/projects/search?limit=1");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "time_entries", tools: ["time_entries.search", "time_entries.create"] },
      { domain: "projects", tools: ["projects.search"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      // GET /workdays/search is confirmed to exist and to return per-day work-time entries
      // (project_id, employee_id) per clockin's own support FAQ — exact filter query-param names
      // aren't independently confirmed, `from`/`to` is a best-effort guess pending verification.
      case "time_entries.search": {
        const params = new URLSearchParams();
        if (input.start_date) params.set("from", String(input.start_date));
        if (input.end_date) params.set("to", String(input.end_date));
        const qs = params.toString();
        const data = await this.request(`/workdays/search${qs ? `?${qs}` : ""}`);
        return { data };
      }
      // POST /events is confirmed to exist for retroactive time entry per clockin's support FAQ.
      // Body field names are a best-effort guess (start/end/project_id/employee_id) pending
      // verification against a live account.
      case "time_entries.create": {
        const startTime = String(input.start_time ?? "");
        if (!startTime) throw new Error("start_time is required.");
        const employeeId = input.employee_id ? String(input.employee_id) : "";
        if (!employeeId) throw new Error("employee_id is required for clockin.");
        const body: Record<string, unknown> = {
          employee_id: employeeId,
          start: new Date(Date.parse(startTime)).toISOString(),
          description: input.description ? String(input.description) : undefined,
          project_id: input.project_id ? String(input.project_id) : undefined,
        };
        if (input.end_time) body.end = new Date(Date.parse(String(input.end_time))).toISOString();
        const data = await this.request("/events", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "projects.search": {
        const params = new URLSearchParams();
        if (input.search) params.set("term", String(input.search));
        params.set("limit", String(input.limit ?? 25));
        const data = await this.request(`/projects/search?${params.toString()}`);
        return { data };
      }
      default:
        throw new Error(`clockin connector does not support tool '${tool}'.`);
    }
  }
}
