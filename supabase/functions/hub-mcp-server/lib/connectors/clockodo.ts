/**
 * Clockodo connector — time tracking (German). Auth: `X-ClockodoApiUser` (account email) +
 * `X-ClockodoApiKey` (API key, from My Area → API), plus a mandatory
 * `X-Clockodo-External-Application: "{app name};{contact email}"` header identifying the calling
 * application (required by Clockodo on every request, not per-integration — sourced from the
 * `CLOCKODO_EXTERNAL_APP_CONTACT` env var, defaulting to a generic Hub identifier if unset).
 *
 * Base host `https://my.clockodo.com`, but NOT one uniform API version — per Clockodo's own
 * "Deprecation of legacy API endpoints on May 1, 2026" announcement (clockodo.com/en/blog/
 * deprecation-of-legacy-api-endpoints-on-may-1-2026/, confirmed 2026-09), `/api/v2/customers` and
 * `/api/v2/projects` were retired in favor of `/api/v3/customers` and `/api/v4/projects` — only
 * `/api/v2/entries` stayed on v2. Using v2 for customers/projects (as this connector originally
 * did) hits a removed route on any account after that cutover. The exact v3/v4 response envelope
 * shape (whether a fetched resource nests under `data`, the resource name, or is returned flat)
 * could not be independently confirmed from public docs this session (docs.clockodo.com is a
 * JS-rendered SPA) — `unwrapResource()` below tries several plausible shapes defensively; verify
 * against a live account before enabling.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const BASE = "https://my.clockodo.com/api";
const ENTRIES_VERSION = "v2";
const CUSTOMERS_VERSION = "v3";
const PROJECTS_VERSION = "v4";

export interface ClockodoCredentials {
  email: string;
  apiKey: string;
}

function externalApplicationHeader(): string {
  return Deno.env.get("CLOCKODO_EXTERNAL_APP_CONTACT") ?? "AI Integration Hub;support@toasternet.eu";
}

/** Best-effort unwrap for a single-resource GET whose exact response envelope isn't confirmed —
 *  tries the given resource-name key, then a generic `data` key, then falls back to the body
 *  itself if it already looks like the resource (has the id/whatever field the caller checks
 *  next). Only used for reads the connector needs to inspect fields on (project lookup); list
 *  endpoints are returned to the caller as-is regardless of envelope shape. */
function unwrapResource<T>(body: unknown, resourceKey: string): T {
  const obj = body as Record<string, unknown>;
  if (obj && typeof obj === "object") {
    if (obj[resourceKey] != null) return obj[resourceKey] as T;
    if (obj.data != null) return obj.data as T;
  }
  return body as T;
}

export class ClockodoConnector implements Connector {
  constructor(private creds: ClockodoCredentials) {}

  private async request(version: string, path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${BASE}/${version}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        "X-ClockodoApiUser": this.creds.email,
        "X-ClockodoApiKey": this.creds.apiKey,
        "X-Clockodo-External-Application": externalApplicationHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (res.status === 204) {
      if (!res.ok) throw new Error(`Clockodo HTTP ${res.status}`);
      return null;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: { message?: string } })?.error?.message ?? `Clockodo HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request(CUSTOMERS_VERSION, "/customers");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "time_entries", tools: ["time_entries.search", "time_entries.get", "time_entries.create", "time_entries.update", "time_entries.delete"] },
      { domain: "projects", tools: ["projects.search", "projects.create"] },
      { domain: "clients", tools: ["clients.search", "clients.create"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      // GET /entries requires time_since/time_until (ISO 8601) — Clockodo's own docs mark them
      // required, unlike Toggl/Clockify where a date range is optional.
      case "time_entries.search": {
        const params = new URLSearchParams();
        params.set("time_since", input.start_date ? new Date(Date.parse(String(input.start_date))).toISOString() : "1970-01-01T00:00:00Z");
        params.set("time_until", input.end_date ? new Date(Date.parse(String(input.end_date))).toISOString() : new Date().toISOString());
        const data = await this.request(ENTRIES_VERSION, `/entries?${params.toString()}`);
        return { data };
      }
      case "time_entries.get": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const data = await this.request(ENTRIES_VERSION, `/entries/${encodeURIComponent(entryId)}`);
        return { data };
      }
      // POST /entries — `customers_id` and `billable` are required by Clockodo's own API even
      // though this Hub's canonical time_entries.create doesn't ask for a customer; `services_id`
      // is also nominally required but Clockodo entries can be created with only a project
      // (project's default service is used) — customers_id is resolved from the target project
      // when project_id is given, otherwise the caller must have configured a default via
      // `defaultCustomerId` (not yet supported here — throws instead of silently guessing).
      // NOTE (added on audit): this Hub's canonical schema doesn't flag project_id as required —
      // it is for Clockodo specifically, since that's the only way this connector can resolve
      // which customer to bill. See tools/timeEntries.ts's field description.
      case "time_entries.create": {
        const startTime = String(input.start_time ?? "");
        if (!startTime) throw new Error("start_time is required.");
        const projectId = input.project_id ? String(input.project_id) : "";
        if (!projectId) throw new Error("project_id is required for Clockodo (used to resolve the customer the entry is billed to).");
        const projectBody = await this.request(PROJECTS_VERSION, `/projects/${encodeURIComponent(projectId)}`);
        const project = unwrapResource<{ customers_id?: number }>(projectBody, "project");
        const customersId = project.customers_id;
        if (customersId == null) throw new Error(`Could not resolve a customer for project '${projectId}'.`);
        const body: Record<string, unknown> = {
          customers_id: customersId,
          projects_id: Number(projectId),
          billable: 1,
          time_since: new Date(Date.parse(startTime)).toISOString(),
          text: input.description ? String(input.description) : undefined,
        };
        if (input.end_time) body.time_until = new Date(Date.parse(String(input.end_time))).toISOString();
        const data = await this.request(ENTRIES_VERSION, "/entries", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "time_entries.update": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        const body: Record<string, unknown> = {};
        if (input.start_time) body.time_since = new Date(Date.parse(String(input.start_time))).toISOString();
        if (input.end_time) body.time_until = new Date(Date.parse(String(input.end_time))).toISOString();
        if (input.description != null) body.text = String(input.description);
        if (input.project_id != null) body.projects_id = Number(input.project_id);
        const data = await this.request(ENTRIES_VERSION, `/entries/${encodeURIComponent(entryId)}`, { method: "PUT", body: JSON.stringify(body) });
        return { data };
      }
      case "time_entries.delete": {
        const entryId = String(input.time_entry_id ?? "");
        if (!entryId) throw new Error("time_entry_id is required.");
        await this.request(ENTRIES_VERSION, `/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" });
        return { data: { time_entry_id: entryId, deleted: true } };
      }
      case "projects.search": {
        const data = await this.request(PROJECTS_VERSION, "/projects");
        return { data };
      }
      // POST /projects requires customers_id — no canonical `client_id` maps to it directly
      // (this Hub's projects.create only asks for an optional client_id, which is passed through).
      // NOTE (added on audit): client_id is nominally optional on the canonical schema, but
      // required for Clockodo specifically (a project must belong to a customer there).
      case "projects.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const clientId = input.client_id ? String(input.client_id) : "";
        if (!clientId) throw new Error("client_id is required for Clockodo (a project must belong to a customer).");
        const data = await this.request(PROJECTS_VERSION, "/projects", { method: "POST", body: JSON.stringify({ name, customers_id: Number(clientId) }) });
        return { data };
      }
      case "clients.search": {
        const data = await this.request(CUSTOMERS_VERSION, "/customers");
        return { data };
      }
      case "clients.create": {
        const name = String(input.name ?? "");
        if (!name) throw new Error("name is required.");
        const data = await this.request(CUSTOMERS_VERSION, "/customers", { method: "POST", body: JSON.stringify({ name, billable_default: 1 }) });
        return { data };
      }
      default:
        throw new Error(`Clockodo connector does not support tool '${tool}'.`);
    }
  }
}
