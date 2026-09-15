-- Add Notion to the cms category. Ships disabled per unverified platform convention.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('notion', 'Notion', 'cms', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['notion']
WHERE name IN (
  'cms.pages.search', 'cms.pages.get', 'cms.pages.create', 'cms.pages.update',
  'cms.posts.search', 'cms.posts.get', 'cms.posts.create', 'cms.posts.update',
  'projects.search', 'projects.get', 'projects.create'
)
  AND NOT ('notion' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note =
  'Notion connector is implemented as a stub. Needs direct vendor access to real API docs and a real account to verify.'
  WHERE name = 'notion';
