-- Bug found in the same platform-coverage audit as 20260903000000: contacts.get existed in
-- hub_tool_registry (added in 20260827000008_crm_hubspot.sql, since HubSpot needed it) but no
-- bookkeeping connector (lexoffice/sevdesk/datev) had ever implemented it, despite all three
-- exposing a single-contact-by-id REST endpoint on their real APIs, following the exact same
-- URL convention each connector already uses for its own invoices.get
-- (lib/connectors/lexoffice.ts, sevdesk.ts, datev.ts now implement contacts.get accordingly).

UPDATE hub_tool_registry
SET supported_platforms = supported_platforms || ARRAY['lexoffice', 'sevdesk', 'datev']
WHERE name = 'contacts.get'
  AND NOT ('lexoffice' = ANY(supported_platforms));
