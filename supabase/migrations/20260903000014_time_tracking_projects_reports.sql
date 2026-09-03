-- Part of the exhaustive cross-platform re-audit, time-tracking pass: projects/clients/tags CRUD
-- (create+read) and an aggregated reports endpoint, on Toggl Track and Clockify.
--
-- Previously time_entries.create accepted an opaque project_id with no way to discover or create
-- valid ids -- projects.search/get/create plus clients.*/tags.* close that gap. time_entries.report
-- hits each platform's separate Reports API host (api.track.toggl.com/reports/api/v3,
-- reports.api.clockify.me) for aggregated project/billable totals, genuinely richer than
-- time_entries.search's raw entry list.
--
-- Confidence: Toggl's endpoints (projects/clients/tags core API, and the summary report shape) are
-- confirmed against Toggl's own community API reference, consistent with how this connector's
-- other tools were verified. Clockify's projects/clients/tags are equally confirmed
-- (docs.clockify.me); the Reports API request body shape is lower confidence -- inferred from
-- secondary sources, not spec-verified -- flagged in the connector's own comment.
--
-- Not extended to Personio: out of scope for this round (employees/absence-management are a
-- materially different HR domain, not requested alongside Toggl/Clockify this time).
--
-- Risk: search/get/report default to low/allow, same as every other read tool. create defaults to
-- low/allow too -- a project/client/tag is an administrative record, not a financial document,
-- matching contacts.create's existing precedent.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('time_entries.report', 'time_entries', 'low', 'Get an aggregated time report (totals by project) for a date range.',
   '{"type":"object","required":["integration_id","start_date","end_date"],"properties":{"integration_id":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"}}}',
   ARRAY['toggl', 'clockify'], 'allow'),
  ('projects.search', 'projects', 'low', 'Search projects on a time-tracking integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['toggl', 'clockify'], 'allow'),
  ('projects.get', 'projects', 'low', 'Get one project by id.',
   '{"type":"object","required":["integration_id","project_id"],"properties":{"integration_id":{"type":"string"},"project_id":{"type":"string"}}}',
   ARRAY['toggl', 'clockify'], 'allow'),
  ('projects.create', 'projects', 'low', 'Create a new project on a time-tracking integration.',
   '{"type":"object","required":["integration_id","name"],"properties":{"integration_id":{"type":"string"},"name":{"type":"string"},"client_id":{"type":"string"}}}',
   ARRAY['toggl', 'clockify'], 'allow'),
  ('clients.search', 'clients', 'low', 'Search clients on a time-tracking integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['toggl', 'clockify'], 'allow'),
  ('clients.create', 'clients', 'low', 'Create a new client on a time-tracking integration.',
   '{"type":"object","required":["integration_id","name"],"properties":{"integration_id":{"type":"string"},"name":{"type":"string"}}}',
   ARRAY['toggl', 'clockify'], 'allow'),
  ('tags.search', 'tags', 'low', 'Search tags on a time-tracking integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"}}}',
   ARRAY['toggl', 'clockify'], 'allow'),
  ('tags.create', 'tags', 'low', 'Create a new tag on a time-tracking integration.',
   '{"type":"object","required":["integration_id","name"],"properties":{"integration_id":{"type":"string"},"name":{"type":"string"}}}',
   ARRAY['toggl', 'clockify'], 'allow')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'projects/clients/tags CRUD, time_entries.report added 2026-09-03 -- real, documented endpoints (Toggl community API reference), not yet re-verified against a live account.'
  WHERE name = 'toggl';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'projects/clients/tags CRUD added 2026-09-03 -- real, documented endpoints (docs.clockify.me). time_entries.report also added, but the Reports API request body shape is lower confidence (inferred from secondary sources, not spec-verified) -- see connector source comment. Not yet re-verified against a live account.'
  WHERE name = 'clockify';
