-- Registers the third non-ecommerce category: time tracking via Toggl Track (backend handler
-- already added to hub-mcp-server/tools/timeEntries.ts).
--
-- Ships disabled (enabled=false), same kill-switch pattern as lexoffice/wordpress, until tested
-- against a real Toggl account and flipped on from /superadmin/platforms.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('toggl', 'Toggl Track', 'time_tracking', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('time_entries.search', 'time_entries', 'low', 'List time entries on a time-tracking integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"}}}',
   ARRAY['toggl'], 'allow'),
  ('time_entries.get', 'time_entries', 'low', 'Get one time entry by id.',
   '{"type":"object","required":["integration_id","time_entry_id"],"properties":{"integration_id":{"type":"string"},"time_entry_id":{"type":"string"}}}',
   ARRAY['toggl'], 'allow')
ON CONFLICT (name) DO NOTHING;
