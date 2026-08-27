-- Third bookkeeping platform: DATEV. UNLIKE every other platform added so far, this one could not
-- be verified against a real account — DATEV requires becoming a certified Marktplatz solution
-- partner, with no public self-service signup or sandbox (see lib/connectors/datev.ts's header
-- comment for the full caveat). The connector's endpoint shape is best-effort, inferred from
-- DATEV's public developer-portal marketing pages, not a tested integration.
--
-- Ships disabled (enabled=false) and is expected to stay that way until this Hub completes
-- DATEV's partner certification — do not flip enabled=true on the strength of this migration
-- alone.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('datev', 'DATEV', 'bookkeeping', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'datev')
WHERE name IN ('invoices.search', 'invoices.get', 'contacts.search')
  AND NOT ('datev' = ANY(supported_platforms));
