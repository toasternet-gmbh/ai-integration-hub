-- Second time-tracking platform: Clockify. Ships disabled (enabled=false) until connector tested
-- against a real Clockify workspace.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('clockify', 'Clockify', 'time_tracking', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'clockify')
WHERE name IN ('time_entries.search', 'time_entries.get')
  AND NOT ('clockify' = ANY(supported_platforms));
