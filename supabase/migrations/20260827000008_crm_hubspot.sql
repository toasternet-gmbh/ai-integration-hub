-- New category: CRM, first platform HubSpot (Private App access tokens — the standard
-- server-to-server auth since HubSpot retired static API keys in 2022). contacts.search already
-- exists (added for bookkeeping) and is generic dispatch, so hubspot is just appended to its
-- supported_platforms; contacts.get didn't exist yet (no bookkeeping connector had implemented
-- it) so it's added here as a new tool, alongside deals.search/get which are CRM-specific.
-- Ships disabled (enabled=false) until connector tested against a real HubSpot account.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('hubspot', 'HubSpot', 'crm', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('contacts.get', 'contacts', 'low', 'Get one contact by id.',
   '{"type":"object","required":["integration_id","contact_id"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"}}}',
   ARRAY['hubspot'], 'allow'),
  ('deals.search', 'deals', 'low', 'Search deals/opportunities on a CRM integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['hubspot'], 'allow'),
  ('deals.get', 'deals', 'low', 'Get one deal by id.',
   '{"type":"object","required":["integration_id","deal_id"],"properties":{"integration_id":{"type":"string"},"deal_id":{"type":"string"}}}',
   ARRAY['hubspot'], 'allow')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'hubspot')
WHERE name = 'contacts.search'
  AND NOT ('hubspot' = ANY(supported_platforms));
