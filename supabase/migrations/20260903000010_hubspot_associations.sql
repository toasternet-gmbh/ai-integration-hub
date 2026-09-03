-- Part of the exhaustive cross-platform re-audit: the single most impactful gap found across
-- every platform. HubSpot contacts/deals/companies created through this Hub were all orphaned
-- from each other -- no way to link a contact to the deal it belongs to, or to the company it
-- works for. Confirmed real, documented endpoints (developers.hubspot.com/docs/guides/api/crm/
-- associations/associations-v4): GET .../associations/{toObjectType} to read, PUT
-- .../associations/default/{toObjectType}/{toObjectId} to create an unlabeled default link
-- (HubSpot's own shortcut that avoids needing to know a specific associationTypeId, which varies
-- per object-type pair and per account). Built against HubSpot's newer date-versioned API path
-- (2026-03) rather than /crm/v4/, which HubSpot is phasing out for anything built from here on.
--
-- Risk: low/allow for both -- linking two already-existing CRM records carries no financial or
-- legal weight, the same posture contacts.create/deals.create already take.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('associations.list', 'associations', 'low', 'List the records of one object type associated with a CRM record (e.g. the deals linked to a contact).',
   '{"type":"object","required":["integration_id","object_type","object_id","to_object_type"],"properties":{"integration_id":{"type":"string"},"object_type":{"type":"string"},"object_id":{"type":"string"},"to_object_type":{"type":"string"}}}',
   ARRAY['hubspot'], 'allow'),
  ('associations.create', 'associations', 'low', 'Link two CRM records together (e.g. attach a contact to a deal).',
   '{"type":"object","required":["integration_id","object_type","object_id","to_object_type","to_object_id"],"properties":{"integration_id":{"type":"string"},"object_type":{"type":"string"},"object_id":{"type":"string"},"to_object_type":{"type":"string"},"to_object_id":{"type":"string"}}}',
   ARRAY['hubspot'], 'allow')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'associations.list/create added 2026-09-03 -- real, documented endpoints on HubSpot''s 2026-03 dated API, not yet re-verified against a live account.'
  WHERE name = 'hubspot';
