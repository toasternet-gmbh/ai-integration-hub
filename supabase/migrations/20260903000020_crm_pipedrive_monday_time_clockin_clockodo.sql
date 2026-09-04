-- Phase 1 of the founder's platform-expansion roadmap: two more CRM platforms (Pipedrive,
-- monday.com/"monday sales CRM") and two more time-tracking platforms (clockin, Clockodo). All
-- four reuse tool names that already exist in hub_tool_registry (contacts.*/deals.*/companies.*
-- for CRM, time_entries.*/projects.*/clients.* for time tracking) -- no new tool names needed,
-- same posture as the original HubSpot addition. See each connector's header comment for
-- API-confidence caveats:
--   * Pipedrive: v2 REST API, x-api-token header, company-domain-scoped. High confidence.
--   * monday.com: single GraphQL endpoint, personal API token. Generic boards/items platform, not
--     a dedicated CRM object model like HubSpot/Pipedrive -- the connector needs board ids as
--     extra credentials and can only best-effort map deal amount/stage onto account-specific
--     columns. Implements the full contacts/deals/companies set the registry lists below, but with
--     that caveat.
--   * clockin: only GET /workdays/search, POST /events, GET/projects/search are independently
--     confirmed to exist (via clockin's own support FAQ, not full interactive docs). Deliberately
--     narrow: only time_entries.search/create and projects.search are registered -- no
--     time_entries.get/update/delete/report or clients.*/tags.*, since those aren't confirmed to
--     exist on this API at all.
--   * Clockodo: REST API v2, well-documented, X-ClockodoApiUser/X-ClockodoApiKey +
--     X-Clockodo-External-Application headers. Full time_entries CRUD (no .report -- Clockodo's
--     reporting surface wasn't confirmed) plus projects/clients.
--
-- All four ship enabled=false per the standard kill-switch convention, until each is tested
-- against a real trial account.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('pipedrive', 'Pipedrive', 'crm', 'api_key', false),
  ('monday', 'monday.com', 'crm', 'api_key', false),
  ('clockin', 'clockin', 'time_tracking', 'api_key', false),
  ('clockodo', 'Clockodo', 'time_tracking', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['pipedrive', 'monday']
WHERE name IN ('contacts.search', 'contacts.get', 'contacts.create', 'deals.search', 'deals.get', 'deals.create', 'companies.search', 'companies.get')
  AND NOT ('pipedrive' = ANY(supported_platforms));

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['clockin']
WHERE name IN ('time_entries.search', 'time_entries.create', 'projects.search')
  AND NOT ('clockin' = ANY(supported_platforms));

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['clockodo']
WHERE name IN ('time_entries.search', 'time_entries.get', 'time_entries.create', 'time_entries.update', 'time_entries.delete', 'projects.search', 'projects.create', 'clients.search', 'clients.create')
  AND NOT ('clockodo' = ANY(supported_platforms));
