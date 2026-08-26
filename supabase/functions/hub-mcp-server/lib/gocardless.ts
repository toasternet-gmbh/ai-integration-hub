/**
 * Shared low-level client for GoCardless Bank Account Data (formerly Nordigen) — the Hub's
 * banking aggregator. Unlike every other connector, this isn't per-integration credentials: one
 * GOCARDLESS_SECRET_ID/GOCARDLESS_SECRET_KEY pair (the Hub's own developer account with
 * GoCardless) authenticates every requisition/account call across all projects. What's
 * per-integration is the requisition id and the resulting account ids from the end user's own
 * consent — see lib/connectors/gocardless.ts and tools/banking.ts.
 *
 * Docs: docs.gocardless.com/bank-account-data. No official sandbox base URL — GoCardless instead
 * offers a sandbox *institution* (SANDBOXFINANCE_SFIN0000) reachable through the normal
 * production API gateway.
 */

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { detail?: string; summary?: string })?.detail
      ?? (body as { summary?: string })?.summary
      ?? `GoCardless HTTP ${res.status}`;
    throw new Error(message);
  }
  return body;
}

/** Exchanges GOCARDLESS_SECRET_ID/KEY for a bearer access token, caching it in memory for the
 *  life of this isolate. Handles both documented response shapes defensively: /token/new/ may
 *  return {access, refresh} directly, or only {refresh}, requiring a follow-up /token/refresh/
 *  call to mint the access token. */
export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }

  const secretId = Deno.env.get("GOCARDLESS_SECRET_ID");
  const secretKey = Deno.env.get("GOCARDLESS_SECRET_KEY");
  if (!secretId || !secretKey) throw new Error("GOCARDLESS_SECRET_ID/GOCARDLESS_SECRET_KEY are not configured.");

  const initial = (await requestJson("/token/new/", {
    method: "POST",
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  })) as { access?: string; access_expires?: number; refresh?: string };

  let access = initial.access;
  let accessExpires = initial.access_expires;
  if (!access && initial.refresh) {
    const refreshed = (await requestJson("/token/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: initial.refresh }),
    })) as { access: string; access_expires: number };
    access = refreshed.access;
    accessExpires = refreshed.access_expires;
  }
  if (!access) throw new Error("GoCardless token response did not include an access token.");

  cachedAccessToken = { token: access, expiresAt: Date.now() + (accessExpires ?? 3600) * 1000 };
  return access;
}

async function authedRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken();
  return requestJson(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
}

export interface Institution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
}

export function listInstitutions(country: string): Promise<Institution[]> {
  return authedRequest(`/institutions/?country=${encodeURIComponent(country)}`) as Promise<Institution[]>;
}

export interface Requisition {
  id: string;
  status: string;
  link: string;
  accounts: string[];
}

export function createRequisition(opts: { institutionId: string; redirectUrl: string; reference: string }): Promise<Requisition> {
  return authedRequest("/requisitions/", {
    method: "POST",
    body: JSON.stringify({ institution_id: opts.institutionId, redirect: opts.redirectUrl, reference: opts.reference }),
  }) as Promise<Requisition>;
}

export function getRequisition(requisitionId: string): Promise<Requisition> {
  return authedRequest(`/requisitions/${encodeURIComponent(requisitionId)}/`) as Promise<Requisition>;
}

export function getAccountDetails(accountId: string): Promise<unknown> {
  return authedRequest(`/accounts/${encodeURIComponent(accountId)}/details/`);
}

export function getAccountBalances(accountId: string): Promise<unknown> {
  return authedRequest(`/accounts/${encodeURIComponent(accountId)}/balances/`);
}

export function getAccountTransactions(accountId: string, params: { dateFrom?: string; dateTo?: string } = {}): Promise<unknown> {
  const qs = new URLSearchParams();
  if (params.dateFrom) qs.set("date_from", params.dateFrom);
  if (params.dateTo) qs.set("date_to", params.dateTo);
  const query = qs.toString();
  return authedRequest(`/accounts/${encodeURIComponent(accountId)}/transactions/${query ? `?${query}` : ""}`);
}
