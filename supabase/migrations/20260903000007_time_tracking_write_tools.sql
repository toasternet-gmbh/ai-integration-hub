-- Founder-relayed follow-up audit of time-tracking platforms (parallel to the e-commerce/CMS/CRM
-- audits). All three platforms previously implemented only time_entries.search/get -- confirmed
-- against official docs that create/update/delete are real, documented endpoints on all three:
--
--   * Toggl Track: POST/PUT/DELETE /workspaces/{id}/time_entries[/{id}] (api.track.toggl.com/v9).
--     A running timer is Toggl's own sentinel convention (negative duration, no stop), not a
--     separate endpoint -- time_entries.create with end_time omitted covers it.
--   * Clockify: POST/PUT/DELETE /workspaces/{id}/time-entries[/{id}] (api.clockify.me/v1). Same
--     "omit end_time to start a running timer" posture; setting end_time via time_entries.update
--     stops it -- no separate stop endpoint needed.
--   * Personio: POST/PATCH/DELETE /v2/attendance-periods[/{id}] (api.personio.de/v2). Personio is
--     an HR attendance ledger, not a stopwatch -- no running-timer concept, so end_time is always
--     required there, and every period is scoped to a specific employee (person.id) rather than
--     "whoever's API token this is" the way Toggl/Clockify are. Personio's own approval workflow
--     and per-day update-limit still apply after the Hub's own approval gate -- this connector
--     deliberately doesn't set skip_approval=true.
--
-- Risk: medium/require_approval for all three actions on all three platforms -- a time entry feeds
-- into billing and payroll even though it isn't itself a financial document, the same posture
-- vouchers.create_from_file already takes for an untested write path with real downstream effects.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('time_entries.create', 'time_entries', 'medium', 'Log a new time entry. Omit end_time to start a running timer (Toggl/Clockify only).',
   '{"type":"object","required":["integration_id","start_time"],"properties":{"integration_id":{"type":"string"},"description":{"type":"string"},"start_time":{"type":"string"},"end_time":{"type":"string"},"project_id":{"type":"string"},"employee_id":{"type":"string"}}}',
   ARRAY['toggl', 'clockify', 'personio'], 'require_approval'),
  ('time_entries.update', 'time_entries', 'medium', 'Update an existing time entry.',
   '{"type":"object","required":["integration_id","time_entry_id"],"properties":{"integration_id":{"type":"string"},"time_entry_id":{"type":"string"},"description":{"type":"string"},"start_time":{"type":"string"},"end_time":{"type":"string"},"project_id":{"type":"string"}}}',
   ARRAY['toggl', 'clockify', 'personio'], 'require_approval'),
  ('time_entries.delete', 'time_entries', 'medium', 'Delete an existing time entry.',
   '{"type":"object","required":["integration_id","time_entry_id"],"properties":{"integration_id":{"type":"string"},"time_entry_id":{"type":"string"}}}',
   ARRAY['toggl', 'clockify', 'personio'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'time_entries.create/update/delete added 2026-09-03 -- real, documented endpoints, not yet re-verified against a live account.'
  WHERE name IN ('toggl', 'clockify', 'personio');
