-- Adds a `category` layer above individual platform types (so the Hub isn't just "ecommerce
-- platforms" anymore — bookkeeping/CMS/time-tracking/banking are categories too), an `auth_type`
-- so the frontend knows whether a platform needs a credentials form or an OAuth redirect, and
-- registers the first non-ecommerce category: bookkeeping via Lexoffice (invoices.*/contacts.*
-- read tools — backend handlers already added to hub-mcp-server/tools/bookkeeping.ts).
--
-- lexoffice ships disabled (enabled=false) — same kill-switch pattern as every other platform —
-- until its connector has been exercised against a real Lexoffice account and flipped on from
-- /superadmin/platforms.

ALTER TABLE hub_platform_types
  ADD COLUMN category TEXT NOT NULL DEFAULT 'ecommerce',
  ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'api_key' CHECK (auth_type IN ('api_key', 'oauth2'));

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('lexoffice', 'Lexoffice', 'bookkeeping', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('invoices.search', 'invoices', 'low', 'Search invoices on a bookkeeping integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"status":{"type":"string"},"page":{"type":"number"}}}',
   ARRAY['lexoffice'], 'allow'),
  ('invoices.get', 'invoices', 'low', 'Get one invoice by id.',
   '{"type":"object","required":["integration_id","invoice_id"],"properties":{"integration_id":{"type":"string"},"invoice_id":{"type":"string"}}}',
   ARRAY['lexoffice'], 'allow'),
  ('contacts.search', 'contacts', 'low', 'Search contacts (customers/vendors) on a bookkeeping integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"name":{"type":"string"},"email":{"type":"string"},"page":{"type":"number"}}}',
   ARRAY['lexoffice'], 'allow')
ON CONFLICT (name) DO NOTHING;
