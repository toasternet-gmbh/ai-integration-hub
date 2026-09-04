/**
 * openHandwerk connector — ERP (German craft/trades business management: quotes, invoices,
 * scheduling). BEST-EFFORT / UNVERIFIED, same tier as datev.ts: openHandwerk's REST API
 * ("openHandwerk REST API", part of "openConnect") requires 10 openHandwerk licenses plus a
 * €20/month add-on before it's even unlocked in the account, and no public developer
 * documentation (endpoint paths, field names, auth scheme) could be found — everything openly
 * published about it is marketing copy pointing at Zapier-style no-code integrations, not a REST
 * reference. There is nothing to responsibly infer an endpoint shape from, unlike DATEV (which at
 * least publishes an OAuth2 client-credentials model on developer.datev.de) or 123erfasst (which
 * exposes its GraphQL schema publicly).
 *
 * This connector is intentionally a stub: it validates credentials shape and fails clearly on any
 * tool call, rather than guessing at endpoints that would silently 404 or worse. Ships with
 * `hub_platform_types.enabled = false`. Do not implement real endpoints here until this Hub has
 * direct access to openHandwerk's actual API documentation (requires contacting their sales team
 * to unlock the openConnect add-on) — see the migration comment that added this platform.
 */
import type { Connector, ConnectionResult, Capability, ToolResult } from "./types.ts";

export interface OpenHandwerkCredentials {
  apiKey: string;
  accountId: string;
}

export class OpenHandwerkConnector implements Connector {
  constructor(private creds: OpenHandwerkCredentials) {
    if (!creds.apiKey || !creds.accountId) throw new Error("openHandwerk credentials require both apiKey and accountId.");
  }

  async testConnection(): Promise<ConnectionResult> {
    return {
      ok: false,
      message: "openHandwerk's REST API has no public documentation to build a verified connector against yet — this platform is a stub pending direct vendor contact. See lib/connectors/openhandwerk.ts.",
    };
  }

  async getCapabilities(): Promise<Capability[]> {
    return [];
  }

  execute(tool: string): Promise<ToolResult> {
    return Promise.reject(new Error(`openHandwerk connector is an unverified stub — '${tool}' is not implemented. See lib/connectors/openhandwerk.ts.`));
  }
}
