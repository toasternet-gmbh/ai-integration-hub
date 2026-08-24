import { supabase } from "./supabase";

const BILLING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hub-billing`;

export type Subscription = {
  organization_id: string;
  plan: "free" | "pro";
  status: "inactive" | "trialing" | "active" | "past_due" | "canceled";
  current_period_end: string | null;
} | null;

export async function getSubscription(organizationId: string): Promise<Subscription> {
  const { data, error } = await supabase
    .from("hub_subscriptions")
    .select("organization_id, plan, status, current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Subscription;
}

async function callBilling(action: "create_checkout_session" | "create_portal_session", organizationId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(BILLING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, organization_id: organizationId }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json.url as string;
}

export const createCheckoutSession = (organizationId: string) => callBilling("create_checkout_session", organizationId);
export const createPortalSession = (organizationId: string) => callBilling("create_portal_session", organizationId);
