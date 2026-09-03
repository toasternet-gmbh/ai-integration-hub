-- Part of the exhaustive cross-platform re-audit, second CMS/CRM pass: WordPress media/comments,
-- Contentful entry update + assets, HubSpot tickets (a real, distinct fourth core CRM object) and
-- owners (who a record can be assigned to).
--
-- All real, documented, high-confidence endpoints (developer.wordpress.org/rest-api/reference,
-- contentful.com/developers/docs/references/content-management-api, developers.hubspot.com/docs/
-- api/crm). cms.pages.update is Contentful-only and only actually usable on an integration that
-- also has a managementToken configured (same gating as cms.pages.create already has).
--
-- Risk: reads (cms.media.search/get, cms.comments.search/get, cms.assets.search/get,
-- tickets.search/get, owners.search) default to low/allow. cms.media.create (publishing a file to
-- the live site) and cms.comments.update (a publicly-visible moderation action) default to
-- medium/require_approval, the same tier as cms.posts.create/update. cms.pages.update also
-- medium/require_approval, matching cms.pages.create. tickets.create defaults to low/allow,
-- matching contacts.create/deals.create's precedent -- a CRM record isn't a financial document.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('cms.pages.update', 'cms', 'medium', 'Update an existing content entry on a CMS integration.',
   '{"type":"object","required":["integration_id","page_id","fields"],"properties":{"integration_id":{"type":"string"},"page_id":{"type":"string"},"fields":{"type":"object"},"publish":{"type":"boolean"}}}',
   ARRAY['contentful'], 'require_approval'),
  ('cms.media.search', 'cms', 'low', 'Search media/attachments on a CMS integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['wordpress'], 'allow'),
  ('cms.media.get', 'cms', 'low', 'Get one media item by id.',
   '{"type":"object","required":["integration_id","media_id"],"properties":{"integration_id":{"type":"string"},"media_id":{"type":"string"}}}',
   ARRAY['wordpress'], 'allow'),
  ('cms.media.create', 'cms', 'medium', 'Upload a media file (image or other) to a CMS integration.',
   '{"type":"object","required":["integration_id","file_base64","file_name"],"properties":{"integration_id":{"type":"string"},"file_base64":{"type":"string"},"file_name":{"type":"string"},"mime_type":{"type":"string"}}}',
   ARRAY['wordpress'], 'require_approval'),
  ('cms.comments.search', 'cms', 'low', 'Search comments on a CMS integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"status":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['wordpress'], 'allow'),
  ('cms.comments.get', 'cms', 'low', 'Get one comment by id.',
   '{"type":"object","required":["integration_id","comment_id"],"properties":{"integration_id":{"type":"string"},"comment_id":{"type":"string"}}}',
   ARRAY['wordpress'], 'allow'),
  ('cms.comments.update', 'cms', 'medium', 'Moderate a comment (change its status, e.g. to approve, spam, or trash it).',
   '{"type":"object","required":["integration_id","comment_id","status"],"properties":{"integration_id":{"type":"string"},"comment_id":{"type":"string"},"status":{"type":"string"}}}',
   ARRAY['wordpress'], 'require_approval'),
  ('cms.assets.search', 'cms', 'low', 'Search media assets on a CMS integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['contentful'], 'allow'),
  ('cms.assets.get', 'cms', 'low', 'Get one media asset by id.',
   '{"type":"object","required":["integration_id","asset_id"],"properties":{"integration_id":{"type":"string"},"asset_id":{"type":"string"}}}',
   ARRAY['contentful'], 'allow'),
  ('tickets.search', 'tickets', 'low', 'Search support tickets on a CRM integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['hubspot'], 'allow'),
  ('tickets.get', 'tickets', 'low', 'Get one ticket by id.',
   '{"type":"object","required":["integration_id","ticket_id"],"properties":{"integration_id":{"type":"string"},"ticket_id":{"type":"string"}}}',
   ARRAY['hubspot'], 'allow'),
  ('tickets.create', 'tickets', 'low', 'Create a new support ticket on a CRM integration.',
   '{"type":"object","required":["integration_id","subject"],"properties":{"integration_id":{"type":"string"},"subject":{"type":"string"},"description":{"type":"string"}}}',
   ARRAY['hubspot'], 'allow'),
  ('owners.search', 'owners', 'low', 'List the owners (team members who can be assigned to records) on a CRM integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['hubspot'], 'allow')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'cms.media.*/cms.comments.* added 2026-09-03 -- real, documented core WordPress resources, same Application Password auth as the existing tools.'
  WHERE name = 'wordpress';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'cms.pages.update, cms.assets.search/get added 2026-09-03 -- real, documented Content Management/Content Delivery API endpoints, not yet re-verified against a live account.'
  WHERE name = 'contentful';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'tickets.search/get/create, owners.search, associations.list/create added 2026-09-03 -- real, documented endpoints, not yet re-verified against a live account.'
  WHERE name = 'hubspot';
