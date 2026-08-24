// Stripe webhook receiver for subscription lifecycle events. Public endpoint (no Supabase JWT —
// verified instead via the Stripe-Signature header), so this must be deployed with
// `verify_jwt = false` (see supabase/config.toml).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";

const STRIPE_LIVE = Deno.env.get("STRIPE_LIVE") === "true";
const STRIPE_SECRET_KEY = STRIPE_LIVE ? Deno.env.get("STRIPE_SECRET_KEY") : Deno.env.get("STRIPE_SECRET_KEY_SANDBOX");
const STRIPE_WEBHOOK_SECRET = STRIPE_LIVE ? Deno.env.get("STRIPE_WEBHOOK_SECRET") : Deno.env.get("STRIPE_WEBHOOK_SECRET_SANDBOX");

const stripe = new Stripe(STRIPE_SECRET_KEY ?? "");
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function planForPriceId(subscription: Stripe.Subscription): "pro" | "free" {
  return subscription.items.data.some((i) => i.price.id === Deno.env.get("STRIPE_PRICE_ID_PRO")) ? "pro" : "free";
}

// Stripe has moved `current_period_end` from the Subscription object to each subscription item
// across API versions — read whichever is present rather than assuming one shape.
function currentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const raw = (subscription as unknown as { current_period_end?: number }).current_period_end
    ?? subscription.items.data[0]?.current_period_end;
  return typeof raw === "number" ? new Date(raw * 1000).toISOString() : null;
}

async function upsertFromSubscription(organizationId: string, subscription: Stripe.Subscription) {
  await admin.from("hub_subscriptions").upsert({
    organization_id: organizationId,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    plan: subscription.status === "canceled" ? "free" : planForPriceId(subscription),
    status: subscription.status,
    current_period_end: currentPeriodEnd(subscription),
  }, { onConflict: "organization_id" });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!STRIPE_WEBHOOK_SECRET) return new Response("Webhook secret not configured", { status: 500 });

  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  if (!signature) return new Response("Missing Stripe-Signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`Signature verification failed: ${(e as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organization_id;
        if (organizationId && session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertFromSubscription(organizationId, subscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organization_id;
        if (organizationId) await upsertFromSubscription(organizationId, subscription);
        break;
      }
    }
  } catch (e) {
    console.error("hub-billing-webhook handler error", e);
    return new Response(`Handler error: ${(e as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
