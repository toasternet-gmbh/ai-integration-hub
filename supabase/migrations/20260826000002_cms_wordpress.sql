-- Registers the second non-ecommerce category: CMS via WordPress (Application Passwords —
-- backend handler already added to hub-mcp-server/tools/cms.ts). 'wordpress' was already allowed
-- by hub_integrations' old platform CHECK constraint (replaced by the FK in
-- 20260826000001_hub_integrations_platform_fk.sql) but never had a hub_platform_types row of its
-- own until now, so it was unreachable from the UI.
--
-- Ships disabled (enabled=false), same kill-switch pattern as lexoffice, until tested against a
-- real WordPress site and flipped on from /superadmin/platforms.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('wordpress', 'WordPress', 'cms', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('cms.pages.search', 'cms', 'low', 'Search pages on a CMS integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"status":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['wordpress'], 'allow'),
  ('cms.pages.get', 'cms', 'low', 'Get one page by id.',
   '{"type":"object","required":["integration_id","page_id"],"properties":{"integration_id":{"type":"string"},"page_id":{"type":"string"}}}',
   ARRAY['wordpress'], 'allow')
ON CONFLICT (name) DO NOTHING;
