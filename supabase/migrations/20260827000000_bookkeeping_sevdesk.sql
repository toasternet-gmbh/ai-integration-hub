-- Second bookkeeping platform: sevDesk (single API-token auth, same posture as Lexoffice).
-- Adds a platform to an EXISTING domain (invoices.*/contacts.* already registered for lexoffice
-- in 20260826000000) — so this appends to those rows' supported_platforms rather than inserting
-- new hub_tool_registry rows.
--
-- Ships disabled (enabled=false) until connector tested against a real sevDesk account.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('sevdesk', 'sevDesk', 'bookkeeping', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'sevdesk')
WHERE name IN ('invoices.search', 'invoices.get', 'contacts.search')
  AND NOT ('sevdesk' = ANY(supported_platforms));
