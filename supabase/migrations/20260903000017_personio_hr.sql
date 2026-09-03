-- Personio employees.*/absences.*/absence_types.search -- excluded from the earlier time-tracking
-- expansion round (Toggl/Clockify projects/clients/tags) since it's a materially different HR
-- domain, not something a pure stopwatch tool has. Confirmed real, real field shapes fetched
-- directly from developer.personio.de's API reference: GET /v2/persons (employees.*),
-- GET/POST/PATCH/DELETE /v2/absence-periods (absences.*), GET /v2/absence-types
-- (absence_types.search -- a lookup needed to populate absences.create's absence_type_id).
--
-- Same OAuth2 bearer auth already implemented for this connector's time_entries.* tools.
-- absences.create deliberately never sets Personio's own `skip_approval=true` query parameter --
-- Personio's own approval workflow still applies after the Hub's own approval gate, the same
-- "belt and suspenders" posture time_entries.create already takes on this connector.
--
-- Risk: employees.search/get and absence_types.search/absences.search/get default to low/allow,
-- same as every other read tool. absences.create/update/delete default to medium/require_approval,
-- matching time_entries.create/update/delete's existing tier -- a real HR record with payroll/
-- attendance effects, even though it isn't itself a financial document.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('employees.search', 'employees', 'low', 'Search employees on an HR integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"status":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['personio'], 'allow'),
  ('employees.get', 'employees', 'low', 'Get one employee by id.',
   '{"type":"object","required":["integration_id","employee_id"],"properties":{"integration_id":{"type":"string"},"employee_id":{"type":"string"}}}',
   ARRAY['personio'], 'allow'),
  ('absence_types.search', 'absences', 'low', 'List the absence types (e.g. vacation, sick leave) configured on an HR integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"}}}',
   ARRAY['personio'], 'allow'),
  ('absences.search', 'absences', 'low', 'Search absence/time-off periods on an HR integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"employee_id":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"}}}',
   ARRAY['personio'], 'allow'),
  ('absences.get', 'absences', 'low', 'Get one absence period by id.',
   '{"type":"object","required":["integration_id","absence_id"],"properties":{"integration_id":{"type":"string"},"absence_id":{"type":"string"}}}',
   ARRAY['personio'], 'allow'),
  ('absences.create', 'absences', 'medium', 'Request a new absence/time-off period for an employee.',
   '{"type":"object","required":["integration_id","employee_id","absence_type_id","start_date"],"properties":{"integration_id":{"type":"string"},"employee_id":{"type":"string"},"absence_type_id":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"},"comment":{"type":"string"}}}',
   ARRAY['personio'], 'require_approval'),
  ('absences.update', 'absences', 'medium', 'Update an existing absence period.',
   '{"type":"object","required":["integration_id","absence_id"],"properties":{"integration_id":{"type":"string"},"absence_id":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"},"comment":{"type":"string"}}}',
   ARRAY['personio'], 'require_approval'),
  ('absences.delete', 'absences', 'medium', 'Cancel/delete an existing absence period.',
   '{"type":"object","required":["integration_id","absence_id"],"properties":{"integration_id":{"type":"string"},"absence_id":{"type":"string"}}}',
   ARRAY['personio'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'employees.*/absences.*/absence_types.search added 2026-09-03 -- real, documented v2 endpoints (developer.personio.de), same auth as the existing attendance tools. Not yet re-verified against a live account.'
  WHERE name = 'personio';
