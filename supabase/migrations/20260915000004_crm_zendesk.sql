-- Add Zendesk to the crm category. Ships disabled per unverified platform convention.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('zendesk', 'Zendesk', 'crm', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['zendesk']
WHERE name IN (
  'contacts.search', 'contacts.get', 'contacts.create',
  'companies.search', 'companies.get',
  'tickets.search', 'tickets.get', 'tickets.create'
)
  AND NOT ('zendesk' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note =
  'Zendesk connector is implemented as a stub. Needs direct vendor access to real API docs and a real account to verify.'
  WHERE name = 'zendesk';
