/**
 * Papershift connector — HR (workforce scheduling & absence management), filed under the
 * `time_tracking` category per this repo's existing convention of grouping HR-flavored platforms
 * there (see Personio) rather than a separate category for just one or two platforms. Implements
 * the same `employees.*`/`absences.*`/`absence_types.*` domain Personio does (`tools/hr.ts`).
 *
 * Auth: an `api_token` sent as a request parameter (body for POST/PUT/DELETE, query string for
 * GET) — NOT a header. Every request must also include `interface_language` (ISO 639-1, e.g.
 * "en"). Base: `https://app.papershift.com/public_api/v1` (developers.papershift.com). Confirmed
 * endpoints: `GET/POST/PUT/DELETE /absences`, `PUT /absences/confirm`, `GET /users`.
 *
 * The Papershift API is a paid add-on that must be activated with Papershift's sales/CS team
 * before an api_token can even be generated — this connector's shapes are confirmed against
 * developers.papershift.com's public docs, but NOT tested against a live account (no self-serve
 * trial exists the way Clockify/Toggl have). Ships disabled until that add-on is purchased and a
 * real round-trip is done.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const BASE = "https://app.papershift.com/public_api/v1";

export interface PapershiftCredentials {
  apiToken: string;
  interfaceLanguage?: string;
}

export class PapershiftConnector implements Connector {
  constructor(private creds: PapershiftCredentials) {}

  private get lang(): string {
    return this.creds.interfaceLanguage ?? "en";
  }

  private async request(path: string, method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const body = { api_token: this.creds.apiToken, interface_language: this.lang, ...params };
    let url = `${BASE}${path}`;
    const init: RequestInit = { method, headers: { "Content-Type": "application/json", Accept: "application/json" } };
    if (method === "GET") {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) if (value != null) qs.set(key, String(value));
      url = `${url}?${qs.toString()}`;
    } else {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    const responseBody = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (responseBody as { error?: string; message?: string })?.error ?? (responseBody as { message?: string })?.message ?? `Papershift HTTP ${res.status}`;
      throw new Error(message);
    }
    return responseBody;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/users", "GET", { page: 1 });
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "employees", tools: ["employees.search", "employees.get"] },
      { domain: "absence_types", tools: ["absence_types.search"] },
      { domain: "absences", tools: ["absences.search", "absences.get", "absences.create", "absences.update", "absences.delete"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "employees.search": {
        const data = await this.request("/users", "GET", { page: 1 });
        return { data };
      }
      case "employees.get": {
        const employeeId = String(input.employee_id ?? "");
        if (!employeeId) throw new Error("employee_id is required.");
        const data = await this.request("/users", "GET", { id: employeeId });
        return { data };
      }
      // Confirmed to exist per developers.papershift.com's llms.txt index, but the exact response
      // shape wasn't independently verified this session (unlike /users and /absences, which were
      // fetched from their own documented pages directly).
      case "absence_types.search": {
        const data = await this.request("/absence_types", "GET", {});
        return { data };
      }
      case "absences.search": {
        const params: Record<string, unknown> = {};
        if (input.employee_id) params.user_id = input.employee_id;
        if (input.start_date) params.starts_at = input.start_date;
        if (input.end_date) params.ends_at = input.end_date;
        const data = await this.request("/absences", "GET", params);
        return { data };
      }
      case "absences.get": {
        const absenceId = String(input.absence_id ?? "");
        if (!absenceId) throw new Error("absence_id is required.");
        const data = await this.request("/absences", "GET", { id: absenceId });
        return { data };
      }
      // Papershift's absence response includes a `note` field (per developers.papershift.com's
      // response examples) — mapped from this Hub's canonical `comment` field, best-effort since
      // the exact request-body field name for setting it wasn't independently confirmed this
      // session beyond the response echoing it back.
      case "absences.create": {
        const employeeId = String(input.employee_id ?? "");
        const absenceTypeId = String(input.absence_type_id ?? "");
        const startDate = String(input.start_date ?? "");
        if (!employeeId || !absenceTypeId || !startDate) throw new Error("employee_id, absence_type_id, and start_date are required.");
        const data = await this.request("/absences", "POST", {
          user_id: employeeId,
          absence_type_id: absenceTypeId,
          starts_at: startDate,
          ends_at: input.end_date ?? startDate,
          note: input.comment != null ? String(input.comment) : undefined,
        });
        return { data };
      }
      case "absences.update": {
        const absenceId = String(input.absence_id ?? "");
        if (!absenceId) throw new Error("absence_id is required.");
        const params: Record<string, unknown> = { id: absenceId };
        if (input.start_date) params.starts_at = input.start_date;
        if (input.end_date) params.ends_at = input.end_date;
        if (input.comment != null) params.note = String(input.comment);
        const data = await this.request("/absences", "PUT", params);
        return { data };
      }
      case "absences.delete": {
        const absenceId = String(input.absence_id ?? "");
        if (!absenceId) throw new Error("absence_id is required.");
        await this.request("/absences", "DELETE", { id: absenceId });
        return { data: { absence_id: absenceId, deleted: true } };
      }
      default:
        throw new Error(`Papershift connector does not support tool '${tool}'.`);
    }
  }
}
