-- Add Jira to the productivity category. Ships disabled per unverified platform convention.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('jira', 'Jira', 'productivity', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['jira']
WHERE name IN (
  'projects.search', 'projects.get', 'projects.create',
  'tickets.search', 'tickets.get', 'tickets.create',
  'employees.search', 'employees.get'
)
  AND NOT ('jira' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note =
  'Jira connector is implemented as a stub. Needs direct vendor access to real API docs and a real account to verify.'
  WHERE name = 'jira';
