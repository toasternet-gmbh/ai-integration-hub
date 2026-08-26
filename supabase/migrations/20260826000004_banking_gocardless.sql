-- Registers the fourth and last planned category for this round: banking via GoCardless Bank
-- Account Data (backend handler already added to hub-mcp-server/tools/banking.ts). The one
-- platform so far with auth_type='oauth2' — the frontend renders a "Connect" redirect button
-- instead of a credentials form for it. Read-only by design (accounts.list, transactions.search)
-- — payment initiation is a distinct compliance/licensing question, not bundled in here.
--
-- Ships disabled (enabled=false), same kill-switch pattern as the other new platforms, until
-- GOCARDLESS_SECRET_ID/GOCARDLESS_SECRET_KEY are configured and the flow tested against a real
-- (or GoCardless's public sandbox) bank connection.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('gocardless', 'GoCardless (Open Banking)', 'banking', 'oauth2', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('accounts.list', 'accounts', 'low', 'List linked bank accounts with balances on a banking integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"}}}',
   ARRAY['gocardless'], 'allow'),
  ('transactions.search', 'transactions', 'low', 'Search transactions on a linked bank account.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"account_id":{"type":"string"},"date_from":{"type":"string"},"date_to":{"type":"string"}}}',
   ARRAY['gocardless'], 'allow')
ON CONFLICT (name) DO NOTHING;
