-- Second CMS platform: Contentful, via its Content Delivery API (real, well-documented REST
-- surface — unlike TYPO3 core, no community extension needed). Ships disabled (enabled=false)
-- until connector tested against a real Contentful space.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('contentful', 'Contentful', 'cms', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'contentful')
WHERE name IN ('cms.pages.search', 'cms.pages.get')
  AND NOT ('contentful' = ANY(supported_platforms));
