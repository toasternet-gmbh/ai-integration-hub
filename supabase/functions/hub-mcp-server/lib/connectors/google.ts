/**
 * Google connector — productivity (Gmail + Calendar, one OAuth2 app registration covering both,
 * same "one connector, multiple domains" posture as sevDesk touching both bookkeeping and
 * contacts). Auth: `Authorization: Bearer {accessToken}` — the token is minted/refreshed by
 * lib/oauth2.ts + lib/connectors/oauthRefresh.ts, never by this connector itself. Two separate
 * API hosts under one token: `www.googleapis.com/calendar/v3` and `gmail.googleapis.com/gmail/v1`.
 * Docs: developers.google.com/calendar/api, developers.google.com/gmail/api.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

export interface GoogleCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// deno-lint-ignore no-control-regex
const ASCII_ONLY = /^[\x00-\x7F]*$/;

/** RFC 5322 header field bodies are US-ASCII only; RFC 2047 "encoded-word" syntax
 *  (`=?UTF-8?B?<base64>?=`) is how a non-ASCII value (e.g. a German subject line with umlauts)
 *  gets into one without violating the spec or getting mangled by strict mail systems. Left
 *  as-is when already pure ASCII, which is the common case and needs no encoding at all. */
function encodeMimeHeaderValue(value: string): string {
  if (ASCII_ONLY.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export class GoogleConnector implements Connector {
  constructor(private creds: GoogleCredentials) {}

  private async request(base: string, path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.creds.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: { message?: string } })?.error?.message ?? `Google API HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request(CALENDAR_BASE, "/calendars/primary");
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
        if (input.start_date) params.set("timeMin", new Date(Date.parse(String(input.start_date))).toISOString());
        if (input.end_date) params.set("timeMax", new Date(Date.parse(String(input.end_date))).toISOString());
        params.set("maxResults", String(input.limit ?? 25));
        params.set("singleEvents", "true");
        params.set("orderBy", "startTime");
        const data = await this.request(CALENDAR_BASE, `/calendars/primary/events?${params.toString()}`);
        return { data };
      }
      case "calendar.search": {
        const query = String(input.query ?? "");
        if (!query) throw new Error("query is required.");
        const params = new URLSearchParams({ q: query, maxResults: String(input.limit ?? 25) });
        const data = await this.request(CALENDAR_BASE, `/calendars/primary/events?${params.toString()}`);
        return { data };
      }
      case "calendar.create_event": {
        const subject = String(input.subject ?? "");
        const startTime = String(input.start_time ?? "");
        const endTime = String(input.end_time ?? "");
        if (!subject || !startTime || !endTime) throw new Error("subject, start_time, and end_time are required.");
        const body: Record<string, unknown> = {
          summary: subject,
          start: { dateTime: new Date(Date.parse(startTime)).toISOString() },
          end: { dateTime: new Date(Date.parse(endTime)).toISOString() },
        };
        if (input.description) body.description = String(input.description);
        if (Array.isArray(input.attendees)) body.attendees = input.attendees.map((email) => ({ email: String(email) }));
        const data = await this.request(CALENDAR_BASE, "/calendars/primary/events", { method: "POST", body: JSON.stringify(body) });
        return { data };
      }
      case "mail.search": {
        const query = String(input.query ?? "");
        if (!query) throw new Error("query is required.");
        const params = new URLSearchParams({ q: query, maxResults: String(input.limit ?? 25) });
        const data = await this.request(GMAIL_BASE, `/users/me/messages?${params.toString()}`);
        return { data };
      }
      case "mail.get": {
        const messageId = String(input.message_id ?? "");
        if (!messageId) throw new Error("message_id is required.");
        const data = await this.request(GMAIL_BASE, `/users/me/messages/${encodeURIComponent(messageId)}?format=full`);
        return { data };
      }
      // Gmail's send endpoint takes a full base64url-encoded RFC 2822 message, not structured
      // to/subject/body fields — this builds the minimal plain-text MIME message by hand
      // (developers.google.com/gmail/api/guides/sending).
      case "mail.send": {
        const to = Array.isArray(input.to) ? input.to : [];
        const subject = String(input.subject ?? "");
        const bodyText = String(input.body ?? "");
        if (to.length === 0 || !subject) throw new Error("to and subject are required.");
        const mime = [`To: ${to.join(", ")}`, `Subject: ${encodeMimeHeaderValue(subject)}`, "Content-Type: text/plain; charset=utf-8", "", bodyText].join("\r\n");
        const data = await this.request(GMAIL_BASE, "/users/me/messages/send", {
          method: "POST",
          body: JSON.stringify({ raw: base64UrlEncode(mime) }),
        });
        return { data };
      }
      default:
        throw new Error(`Google connector does not support tool '${tool}'.`);
    }
  }
}
