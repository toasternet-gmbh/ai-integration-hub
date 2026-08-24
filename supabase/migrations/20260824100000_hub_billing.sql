-- Stripe subscription billing for hub_organizations. One row per organization; absence of a row
-- means "free plan, never subscribed" — rows are only ever written by the hub-billing /
-- hub-billing-webhook edge functions (service_role), never directly by clients.
--
-- Lives in ai-integration-hub's own migrations (not yogaipilot's), but is applied to the same
-- shared Supabase project as the rest of the hub_* schema — see supabase/README.md.

CREATE TABLE hub_subscriptions (
  organization_id UUID PRIMARY KEY REFERENCES hub_organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_hub_subscriptions_stripe_customer ON hub_subscriptions (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX idx_hub_subscriptions_stripe_subscription ON hub_subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE TRIGGER trg_hub_subscriptions_updated_at BEFORE UPDATE ON hub_subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE hub_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member select hub_subscriptions" ON hub_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hub_organization_members om WHERE om.organization_id = hub_subscriptions.organization_id AND om.user_id = auth.uid()));
CREATE POLICY "Service role all hub_subscriptions" ON hub_subscriptions FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT ON TABLE hub_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_subscriptions TO service_role;
