/**
 * Outlook connector — productivity (calendar + mail via Microsoft Graph, one OAuth2 app
 * registration covering both, same "one connector, multiple domains" posture as sevDesk touching
 * both bookkeeping and contacts). Auth: `Authorization: Bearer {accessToken}` against
 * `https://graph.microsoft.com/v1.0` — the access token is minted/refreshed by
 * lib/oauth2.ts + lib/connectors/oauthRefresh.ts, never by this connector itself; it just uses
 * whatever token it's constructed with. Docs: learn.microsoft.com/en-us/graph/api/overview.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const BASE = "https://graph.microsoft.com/v1.0";

export interface OutlookCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class OutlookConnector implements Connector {
  constructor(private creds: OutlookCredentials) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.creds.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    if (res.status === 202 || res.status === 204) {
      if (!res.ok) throw new Error(`Microsoft Graph HTTP ${res.status}`);
      return null;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: { message?: string } })?.error?.message ?? `Microsoft Graph HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/me/events?$top=1");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [
      { domain: "calendar", tools: ["calendar.list_events", "calendar.search", "calendar.create_event"] },
      { domain: "mail", tools: ["mail.search", "mail.get", "mail.send"] },
    ];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case "calendar.list_events": {
        const params = new URLSearchParams();
        if (input.start_date) params.set("startDateTime", new Date(Date.parse(String(input.start_date))).toISOString());
        if (input.end_date) params.set("endDateTime", new Date(Date.parse(String(input.end_date))).toISOString());
        params.set("$top", String(input.limit ?? 25));
        const path = params.has("startDateTime") || params.has("endDateTime") ? `/me/calendarView?${params.toString()}` : `/me/events?${params.toString()}`;
        const data = await this.request(path);
        return { data };
      }
      // $search requires the ConsistencyLevel: eventual header (learn.microsoft.com/en-us/graph/
      // search-query-parameter).
      case "calendar.search": {
        const query = String(input.query ?? "");
        if (!query) throw new Error("query is required.");
        const data = await this.request(`/me/events?$search="${encodeURIComponent(query)}"&$top=${Number(input.limit ?? 25)}`, {
          headers: { ConsistencyLevel: "eventual" },
        });
        return { data };
      }
      case "calendar.create_event": {
        const subject = String(input.subject ?? "");
        const startTime = String(input.start_time ?? "");
        const endTime = String(input.end_time ?? "");
        if (!subject || !startTime || !endTime) throw new Error("subject, start_time, and end_time are required.");
        const body: Record<string, unknown> = {
          subject,
          start: { dateTime: new Date(Date.parse(startTime)).toISOString(), timeZone: "UTC" },
          end: { dateTime: new Date(Date.parse(endTime)).toISOString(), timeZone: "UTC" },
        };
        if (input.description) body.body = { contentType: "text", content: String(input.description) };
        if (Array.isArray(input.attendees)) body.attendees = input.attendees.map((email) => ({ emailAddress: { address: String(email) }, type: "required" }));
        const data = await this.request("/me/events", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "mail.search": {
        const query = String(input.query ?? "");
        if (!query) throw new Error("query is required.");
        const data = await this.request(`/me/messages?$search="${encodeURIComponent(query)}"&$top=${Number(input.limit ?? 25)}`, {
          headers: { ConsistencyLevel: "eventual" },
        });
        return { data };
      }
      case "mail.get": {
        const messageId = String(input.message_id ?? "");
        if (!messageId) throw new Error("message_id is required.");
        const data = await this.request(`/me/messages/${encodeURIComponent(messageId)}`);
        return { data };
      }
      // POST /me/sendMail returns 202 Accepted with an empty body — no message resource comes
      // back, so the result is just an acknowledgement.
      case "mail.send": {
        const to = Array.isArray(input.to) ? input.to : [];
        const subject = String(input.subject ?? "");
        const bodyText = String(input.body ?? "");
        if (to.length === 0 || !subject) throw new Error("to and subject are required.");
        await this.request("/me/sendMail", {
          method: "POST",
          body: JSON.stringify({
            message: {
              subject,
              body: { contentType: "text", content: bodyText },
              toRecipients: to.map((email) => ({ emailAddress: { address: String(email) } })),
            },
          }),
        });
        return { data: { sent: true } };
      }
      default:
        throw new Error(`Outlook connector does not support tool '${tool}'.`);
    }
  }
}
