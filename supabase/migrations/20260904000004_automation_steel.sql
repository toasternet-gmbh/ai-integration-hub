-- Phase 4b of the founder's platform-expansion roadmap: Steel.dev, a second platform in the same
-- 'automation' category and browser.* tool domain as Browserless (20260904000002), added at the
-- founder's own request as an alternative/complementary provider. Same architecture and
-- REST-only-for-Deno-compatibility rationale as Browserless -- see lib/connectors/steel.ts's
-- header comment for why its tool coverage is narrower (browser.get_content + browser.screenshot
-- only; no confirmed one-shot REST endpoint for CSS-selector scraping or PDF rendering on this
-- API, unlike Browserless).
--
-- Risk posture: identical to Browserless's own tools -- both are read-only URL fetches, low/allow.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('steel', 'Steel.dev', 'automation', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['steel']
WHERE name IN ('browser.get_content', 'browser.screenshot')
  AND NOT ('steel' = ANY(supported_platforms));
