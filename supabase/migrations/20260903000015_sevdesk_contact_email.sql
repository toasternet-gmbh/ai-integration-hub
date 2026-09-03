-- Final item of the exhaustive cross-platform re-audit: sevDesk's contacts.create/contacts.update
-- `email` field was documented as unsupported ("sevDesk associates an email address via a
-- separate CommunicationWay resource, not a Contact field, so `email` isn't wired up here").
-- Confirmed real and spec-verified this round (POST/PUT /CommunicationWay, required type/value/
-- key -- Model_CommunicationWay in the OpenAPI spec) and wired up in the connector. No new
-- canonical tool or schema change needed -- contacts.create/update's existing `email` input field
-- now actually does something on sevDesk instead of being silently dropped.

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'contacts.create/update email support added 2026-09-03 via the CommunicationWay resource -- confirmed against the official OpenAPI spec, previously documented as unsupported. Not yet re-verified against a live account.'
  WHERE name = 'sevdesk';
