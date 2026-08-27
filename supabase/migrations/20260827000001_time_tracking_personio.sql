-- Second time-tracking platform: Personio (OAuth2 client-credentials — a client_id/client_secret
-- pair, exchanged for a bearer token; still a credentials FORM, not a consent-redirect, so
-- auth_type stays 'api_key' like Shopware's client_id/client_secret pair does).
--
-- Ships disabled (enabled=false) until connector tested against a real Personio account.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('personio', 'Personio', 'time_tracking', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'personio')
WHERE name IN ('time_entries.search', 'time_entries.get')
  AND NOT ('personio' = ANY(supported_platforms));
