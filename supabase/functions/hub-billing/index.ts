// Stripe subscription checkout/portal session creation for hub_organizations. Deployed to the
// same shared Supabase project as yogaipilot's hub-mcp-server (see supabase/README.md) but as a
// separate, self-contained function — no cross-repo imports.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";

const STRIPE_LIVE = Deno.env.get("STRIPE_LIVE") === "true";
const STRIPE_SECRET_KEY = STRIPE_LIVE ? Deno.env.get("STRIPE_SECRET_KEY") : Deno.env.get("STRIPE_SECRET_KEY_SANDBOX");
const STRIPE_PRICE_ID_PRO = Deno.env.get("STRIPE_PRICE_ID_PRO") ?? "";
const HUB_APP_URL = Deno.env.get("HUB_APP_URL") ?? "http://localhost:3060";

const stripe = new Stripe(STRIPE_SECRET_KEY ?? "");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!STRIPE_SECRET_KEY) return json({ error: "Stripe is not configured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
  const userId = userData.user.id;

  let body: { action?: string; organization_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { action, organization_id } = body;
  if (!organization_id) return json({ error: "organization_id is required" }, 400);

  const { data: membership } = await admin
    .from("hub_organization_members")
    .select("role")
    .eq("organization_id", organization_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return json({ error: "Only an organization owner or admin can manage billing" }, 403);
  }

  const { data: sub } = await admin
    .from("hub_subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", organization_id)
    .maybeSingle();

  try {
    if (action === "create_checkout_session") {
      if (!STRIPE_PRICE_ID_PRO) return json({ error: "STRIPE_PRICE_ID_PRO is not configured" }, 500);

      let customerId = sub?.stripe_customer_id ?? null;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userData.user.email ?? undefined,
          metadata: { organization_id },
        });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: STRIPE_PRICE_ID_PRO, quantity: 1 }],
        success_url: `${HUB_APP_URL}/app/billing?checkout=success`,
        cancel_url: `${HUB_APP_URL}/app/billing?checkout=cancel`,
        metadata: { organization_id },
        subscription_data: { metadata: { organization_id } },
      });
      return json({ url: session.url });
    }

    if (action === "create_portal_session") {
      if (!sub?.stripe_customer_id) return json({ error: "No billing account yet — subscribe first" }, 400);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${HUB_APP_URL}/app/billing`,
      });
      return json({ url: portal.url });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
