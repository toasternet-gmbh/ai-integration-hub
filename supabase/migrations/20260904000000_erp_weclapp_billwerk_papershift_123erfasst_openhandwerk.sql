-- Phase 2 of the founder's platform-expansion roadmap: a new 'erp' category (weclapp,
-- openHandwerk -- German SMB/trade business-management platforms broader than plain bookkeeping),
-- plus Billwerk+/Frisbii (bookkeeping/subscription billing) and Papershift/123erfasst
-- (time_tracking, alongside Personio/Clockin per this repo's existing convention of grouping
-- HR-flavored and construction-time-tracking platforms there). See each connector's header
-- comment for API-confidence caveats -- summary:
--   * weclapp: well-documented tenant-scoped REST API (AuthenticationToken header). Confident on
--     the /party (contacts) resource; /salesInvoice line-item field names are best-effort.
--   * Billwerk+ (rebranded Frisbii Billing & Pay): confirmed REST API, HTTP Basic private-key
--     auth. No generic "create invoice" endpoint -- invoices.create maps onto its on-demand
--     /charge endpoint with settle=true; order-line field names are best-effort.
--   * Papershift: confirmed public REST API (developers.papershift.com), but the API itself is a
--     paid add-on Papershift must activate before an api_token can be generated -- no self-serve
--     trial exists, so ships disabled pending that purchase + a real round-trip.
--   * 123erfasst: same unverified tier as DATEV -- a GraphQL API whose OAuth endpoints are
--     discovered per-account via an `authProvider` query, not fixed/public. Only projects.search
--     is registered, and even that is best-effort. Ships disabled.
--   * openHandwerk: a stub with zero implemented tools -- no public developer documentation
--     exists at all (the API needs 10 licenses + a paid add-on to even unlock), so nothing here
--     was safe to infer. Ships disabled; see lib/connectors/openhandwerk.ts before touching it.
--
-- All five ship enabled=false per the standard kill-switch convention.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('weclapp', 'weclapp', 'erp', 'api_key', false),
  ('billwerk', 'Billwerk+', 'bookkeeping', 'api_key', false),
  ('papershift', 'Papershift', 'time_tracking', 'api_key', false),
  ('123erfasst', '123erfasst', 'time_tracking', 'api_key', false),
  ('openhandwerk', 'openHandwerk', 'erp', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['weclapp', 'billwerk']
WHERE name IN ('contacts.search', 'contacts.get', 'contacts.create', 'invoices.search', 'invoices.get', 'invoices.create')
  AND NOT ('weclapp' = ANY(supported_platforms));

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['papershift']
WHERE name IN ('employees.search', 'employees.get', 'absence_types.search', 'absences.search', 'absences.get', 'absences.create', 'absences.update', 'absences.delete')
  AND NOT ('papershift' = ANY(supported_platforms));

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['123erfasst']
WHERE name = 'projects.search'
  AND NOT ('123erfasst' = ANY(supported_platforms));

-- openHandwerk implements no tools yet (unverified stub) -- deliberately not appended to any
-- tool's supported_platforms, matching lib/connectors/openhandwerk.ts's empty getCapabilities().

UPDATE hub_platform_types SET verification_note =
  'openHandwerk''s REST API requires 10 openHandwerk licenses plus a paid openConnect add-on to unlock, and has no public developer documentation. No endpoints could be safely inferred -- ships as a stub with zero implemented tools until this Hub has direct vendor access to real API docs.'
  WHERE name = 'openhandwerk';

UPDATE hub_platform_types SET verification_note =
  '123erfasst exposes a GraphQL API whose OAuth token endpoint is discovered per-account via an authProvider query, not a fixed public URL -- same unverified tier as DATEV. Only projects.search is implemented, and even that query shape is a best-effort guess pending real schema access.'
  WHERE name = '123erfasst';

UPDATE hub_platform_types SET verification_note =
  'Papershift''s API is a paid add-on that must be activated by Papershift''s own sales/CS team before an api_token can be generated -- no self-serve trial exists. Endpoint shapes are confirmed against developers.papershift.com''s public docs but not tested against a live account.'
  WHERE name = 'papershift';
