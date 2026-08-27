-- Second CMS platform: TYPO3. LOW CONFIDENCE, same caveat class as datev.ts/jtl.ts — TYPO3 core
-- ships no built-in inbound REST API for pages (unlike WordPress), so this only works against a
-- site that has a specific community REST extension installed (targets the `cundd/rest` shape) —
-- see lib/connectors/typo3.ts's header comment for the full caveat.
--
-- Ships disabled (enabled=false) until connector tested against a real TYPO3 site running that
-- extension.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('typo3', 'TYPO3', 'cms', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'typo3')
WHERE name IN ('cms.pages.search', 'cms.pages.get')
  AND NOT ('typo3' = ANY(supported_platforms));
