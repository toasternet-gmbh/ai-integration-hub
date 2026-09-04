/**
 * Beeper connector — messaging, via the standard Matrix Client-Server API. Beeper is a unified
 * chat client (iMessage/WhatsApp/Telegram/Signal/... via bridges) built on Matrix — a Beeper
 * account IS a Matrix account under the hood, reachable at the user's own Beeper homeserver, so
 * this connector talks plain Matrix CS API rather than anything Beeper-specific. Auth:
 * `Authorization: Bearer {accessToken}` — the user gets this themselves from their Beeper/Matrix
 * client's own settings (e.g. Beeper Desktop → Settings → Advanced), same "user pastes a
 * long-lived token they generated themselves" shape as WordPress's Application Password, not a
 * consent-redirect. `homeserverUrl` is guarded by assertPublicHttpUrl at connector-creation time
 * in factory.ts, same as every other storeUrl/siteUrl field.
 *
 * This is the least precedented connector in the codebase — no chat/Matrix domain existed here
 * before — so `messages.send` (the one write action) defaults to high/require_approval, same tier
 * as orders.refund: sending a message as the user to a real contact is consequential and
 * effectively irreversible once delivered. Docs: spec.matrix.org/latest/client-server-api/.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface MatrixCredentials {
  homeserverUrl: string;
  accessToken: string;
}

export class MatrixConnector implements Connector {
  constructor(private creds: MatrixCredentials) {}

  private get base(): string {
    return `${this.creds.homeserverUrl.replace(/\/$/, "")}/_matrix/client/v3`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.creds.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: string })?.error ?? `Matrix HTTP ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.request("/account/whoami");
      return { ok: true, message: "Connected" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getCapabilities(): Promise<Capability[]> {
    return [{ domain: "messages", tools: ["messages.list_rooms", "messages.search", "messages.get", "messages.send"] }];
  }

  async execute(tool: string, input: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      // GET /joined_rooms only returns room ids -- each room's display name is a separate piece of
      // room state (m.room.name), so it's fetched per room. A room with no explicit name (e.g. a
      // DM) has no m.room.name state event, which 404s -- treated as "unnamed" rather than failing
      // the whole list.
      case "messages.list_rooms": {
        const joined = (await this.request("/joined_rooms")) as { joined_rooms?: string[] };
        const roomIds = (joined.joined_rooms ?? []).slice(0, Number(input.limit ?? 50));
        const rooms = await Promise.all(
          roomIds.map(async (roomId) => {
            try {
              const state = (await this.request(`/rooms/${encodeURIComponent(roomId)}/state/m.room.name`)) as { name?: string };
              return { room_id: roomId, name: state.name ?? null };
            } catch {
              return { room_id: roomId, name: null };
            }
          }),
        );
        return { data: rooms };
      }
      // POST /search is the real, documented full-text search endpoint
      // (spec.matrix.org/latest/client-server-api/#post_matrixclientv3search) — searches message
      // body content across all rooms the user has joined.
      case "messages.search": {
        const query = String(input.query ?? "");
        if (!query) throw new Error("query is required.");
        const data = await this.request("/search", {
          method: "POST",
          body: JSON.stringify({
            search_categories: {
              room_events: { search_term: query, keys: ["content.body"], order_by: "recent" },
            },
          }),
        });
        return { data };
      }
      case "messages.get": {
        const roomId = String(input.room_id ?? "");
        const messageId = String(input.message_id ?? "");
        if (!roomId || !messageId) throw new Error("room_id and message_id are required.");
        const data = await this.request(`/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(messageId)}`);
        return { data };
      }
      // PUT /rooms/{roomId}/send/m.room.message/{txnId} — the txnId just needs to be unique
      // per-request so a client retry doesn't double-send; a random UUID is the simplest valid one.
      case "messages.send": {
        const roomId = String(input.room_id ?? "");
        const body = String(input.body ?? "");
        if (!roomId || !body) throw new Error("room_id and body are required.");
        const txnId = crypto.randomUUID();
        const data = await this.request(`/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
          method: "PUT",
          body: JSON.stringify({ msgtype: "m.text", body }),
        });
        return { data };
      }
      default:
        throw new Error(`Beeper/Matrix connector does not support tool '${tool}'.`);
    }
  }
}
