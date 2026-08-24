# supabase/ in this repo

The Hub runs against the same shared Supabase project as **yogaipilot** (see
`docs/access-and-accounts.md` for the full writeup) — there is no dedicated Supabase project of
its own. Every table this repo owns is prefixed `hub_` to avoid colliding with yogaipilot's own
unrelated tables of the same short names (`organizations`, `agents`, `api_keys`, ...).

- `migrations/20260823000000_core_schema.sql` — the original standalone-stack schema, kept only
  as a historical record; not applied to the shared project.
- `migrations/20260823090000_add_magento_platform.sql`, `migrations/20260824100000_hub_billing.sql`
  — real, additive migrations meant to be applied to the shared project (see below).
- `functions/hub-mcp-server/` — **does not live in this repo.** The MCP gateway, connectors,
  policy engine, and all tool handlers live inside `yogaipilot/supabase/functions/hub-mcp-server/`
  — edit the code there, not here.
- `functions/hub-billing/`, `functions/hub-billing-webhook/` — **do** live in this repo (Stripe
  subscription checkout/portal + webhook), deployed to the same shared project as a separate
  function pair, self-contained (no imports from yogaipilot's code).

## Deploying `hub-billing*` to the shared project

Requires Supabase CLI access to the shared project (`oipaakxcjmwfhvpzhwcu`) — `supabase login`
with an account that has that access, then:

```bash
npx supabase link --project-ref oipaakxcjmwfhvpzhwcu
npx supabase db push                              # applies migrations/*.sql not yet applied
npx supabase functions deploy hub-billing
npx supabase functions deploy hub-billing-webhook --no-verify-jwt

npx supabase secrets set \
  STRIPE_LIVE=false \
  STRIPE_SECRET_KEY_SANDBOX=sk_test_... \
  STRIPE_WEBHOOK_SECRET_SANDBOX=whsec_...  \
  STRIPE_PRICE_ID_PRO=price_1U7sLULRDPdaPpE2DvlT0yrl \
  HUB_APP_URL=http://localhost:3060
```

`STRIPE_WEBHOOK_SECRET_SANDBOX` comes from registering a webhook endpoint (Stripe dashboard or
`stripe webhook_endpoints create`) pointing at
`https://oipaakxcjmwfhvpzhwcu.supabase.co/functions/v1/hub-billing-webhook`, listening for
`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` —
that can only be created once the function above is deployed and reachable.
