-- Phase 4 of the founder's platform-expansion roadmap: a new 'automation' category and browser.*
-- tool domain (hosted headless-Chrome REST API via Browserless). Architecturally different from
-- every prior connector: this doesn't act on "the customer's own business system", it fetches
-- whatever public URL the caller supplies -- see lib/connectors/browserless.ts's header comment
-- and the assertPublicHttpUrl call it runs on every tool's `url` argument (the first time this
-- codebase validates a URL at tool-CALL time rather than only at connector-creation time).
--
-- Risk posture: all four tools are read-only fetches of a URL (get_content/screenshot/scrape/pdf)
-- -- there's no interactive click/type/submit capability (that would need the CDP/session model
-- this connector deliberately avoids for Deno-compatibility reasons), so there's no
-- state-mutating action for the Policy Engine to gate the way orders.refund does. low/allow for
-- all four, same tier as every other read tool -- the real safeguard here is the URL-validation
-- inside the connector itself, not the policy tier.
--
-- Ships enabled=false per the standard kill-switch convention until tested against a real
-- Browserless account. Steel.dev (an alternative/complementary provider the founder flagged) is a
-- planned Phase 4b addition to this same category and tool domain, not part of this migration.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('browserless', 'Browserless', 'automation', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('browser.get_content', 'browser', 'low', 'Fetch the fully rendered HTML (including JS-rendered content) of a URL via a hosted headless browser.',
   '{"type":"object","required":["integration_id","url"],"properties":{"integration_id":{"type":"string"},"url":{"type":"string"}}}',
   ARRAY['browserless'], 'allow'),
  ('browser.screenshot', 'browser', 'low', 'Take a screenshot of a URL via a hosted headless browser. Returns a base64-encoded PNG.',
   '{"type":"object","required":["integration_id","url"],"properties":{"integration_id":{"type":"string"},"url":{"type":"string"},"full_page":{"type":"boolean"}}}',
   ARRAY['browserless'], 'allow'),
  ('browser.scrape', 'browser', 'low', 'Extract structured data from a URL by CSS selector via a hosted headless browser.',
   '{"type":"object","required":["integration_id","url","selectors"],"properties":{"integration_id":{"type":"string"},"url":{"type":"string"},"selectors":{"type":"array","items":{"type":"string"}}}}',
   ARRAY['browserless'], 'allow'),
  ('browser.pdf', 'browser', 'low', 'Render a URL to PDF via a hosted headless browser. Returns a base64-encoded PDF.',
   '{"type":"object","required":["integration_id","url"],"properties":{"integration_id":{"type":"string"},"url":{"type":"string"}}}',
   ARRAY['browserless'], 'allow')
ON CONFLICT (name) DO NOTHING;
