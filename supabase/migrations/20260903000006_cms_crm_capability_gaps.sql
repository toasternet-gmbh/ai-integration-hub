-- Founder-relayed follow-up audit of CMS and CRM platforms (parallel to the e-commerce audit).
-- All four additions confirmed against official docs (see connector header comments for detail):
--
--   * HubSpot: companies is a real, distinct third CRM object alongside contacts/deals, same
--     /crm/v3/objects/{type} shape already used. contacts.create/deals.create are real, documented
--     single-POST endpoints -- deals.create additionally resolves a default pipeline stage via
--     GET /crm/v3/pipelines/deals when the caller doesn't supply one, since there's no universal
--     default `dealstage` id across HubSpot accounts.
--   * WordPress: cms.posts.* (search/get/create/update) is a real, separate core resource from
--     /pages (blog posts vs. static pages), same Application Password auth already in use.
--   * Contentful: cms.pages.create goes through the separate Content Management API, which needs
--     a genuinely different credential (a Personal Access Token, not the Content Delivery token
--     already stored) -- so it's supported_platforms=['contentful'] but only actually usable on an
--     integration whose owner additionally supplied that token (see contentful.ts).
--
-- Risk: reads (companies.*, cms.posts.search/get) default to low/allow, same tier as every other
-- read tool. contacts.create/deals.create default to low/allow, matching contacts.create's
-- existing precedent (a CRM record isn't a financial document the way an invoice is).
-- cms.posts.create/update and cms.pages.create default to medium/require_approval -- publishing or
-- editing public-facing content is a real-world visible action worth a human glance, the same
-- posture orders.fulfill already takes for a customer-facing side effect.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('companies.search', 'companies', 'low', 'Search companies/organizations on a CRM integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"name":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['hubspot'], 'allow'),
  ('companies.get', 'companies', 'low', 'Get one company by id.',
   '{"type":"object","required":["integration_id","company_id"],"properties":{"integration_id":{"type":"string"},"company_id":{"type":"string"}}}',
   ARRAY['hubspot'], 'allow'),
  ('deals.create', 'deals', 'low', 'Create a new deal/opportunity on a CRM integration.',
   '{"type":"object","required":["integration_id","name"],"properties":{"integration_id":{"type":"string"},"name":{"type":"string"},"amount":{"type":"number"},"stage":{"type":"string"}}}',
   ARRAY['hubspot'], 'allow'),
  ('cms.posts.search', 'cms', 'low', 'Search blog posts on a CMS integration (distinct from static pages).',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"status":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['wordpress'], 'allow'),
  ('cms.posts.get', 'cms', 'low', 'Get one blog post by id.',
   '{"type":"object","required":["integration_id","post_id"],"properties":{"integration_id":{"type":"string"},"post_id":{"type":"string"}}}',
   ARRAY['wordpress'], 'allow'),
  ('cms.posts.create', 'cms', 'medium', 'Create a new blog post on a CMS integration.',
   '{"type":"object","required":["integration_id","title","content"],"properties":{"integration_id":{"type":"string"},"title":{"type":"string"},"content":{"type":"string"},"status":{"type":"string"}}}',
   ARRAY['wordpress'], 'require_approval'),
  ('cms.posts.update', 'cms', 'medium', 'Update an existing blog post on a CMS integration.',
   '{"type":"object","required":["integration_id","post_id"],"properties":{"integration_id":{"type":"string"},"post_id":{"type":"string"},"title":{"type":"string"},"content":{"type":"string"},"status":{"type":"string"}}}',
   ARRAY['wordpress'], 'require_approval'),
  ('cms.pages.create', 'cms', 'medium', 'Create a new content entry on a CMS integration.',
   '{"type":"object","required":["integration_id","content_type_id","fields"],"properties":{"integration_id":{"type":"string"},"content_type_id":{"type":"string"},"fields":{"type":"object"},"publish":{"type":"boolean"}}}',
   ARRAY['contentful'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = supported_platforms || ARRAY['hubspot']
WHERE name = 'contacts.create'
  AND NOT ('hubspot' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'contacts.create, deals.create, companies.search/get added 2026-09-03 -- real, documented endpoints, not yet re-verified against a live account.'
  WHERE name = 'hubspot';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'cms.posts.search/get/create/update added 2026-09-03 -- real, documented core WordPress resource, same auth as the existing pages tools.'
  WHERE name = 'wordpress';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'cms.pages.create added 2026-09-03 -- real, documented Content Management API endpoint, but requires a separate managementToken credential most existing integrations won''t have set; not yet re-verified against a live account.'
  WHERE name = 'contentful';
