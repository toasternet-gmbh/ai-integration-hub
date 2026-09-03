-- Founder-relayed follow-up audit of the remaining bookkeeping platforms (Lexoffice/sevDesk;
-- DATEV remains blocked -- no public sandbox, nothing new to responsibly add without partner
-- certification). Findings this round came from sevDesk's own machine-readable OpenAPI spec
-- (api.sevdesk.de/openapi.yaml), the highest-confidence source used in any audit this session:
--
--   * invoices.finalize (PUT /Invoice/{id}/sendBy) and invoices.record_payment
--     (PUT /Invoice/{id}/bookAmount) close the exact gap flagged when invoices.create shipped --
--     a sevDesk invoice created via this Hub could never leave draft status or be marked paid.
--     Lexoffice has no equivalent API at all (its invoice status is immutable after creation, per
--     developers.lexware.io), so both are sevDesk-only.
--   * invoices.void (POST /Invoice/{id}/cancelInvoice) creates a real reversing cancellation
--     invoice -- sevDesk-only, same reason.
--   * contacts.update and products.update round out CRUD (create existed, update didn't) on both
--     platforms -- spec-confirmed on sevDesk (PUT /Contact/{id}, PUT /Part/{id}), well-corroborated
--     on Lexoffice (PUT /contacts/{id}, PUT /articles/{id}).
--   * Lexoffice now also gets vouchers.create_from_file -- a prior audit this session declined
--     this as unconfirmable; re-researched this round and found POST /v1/files (multipart) +
--     POST /v1/vouchers (referencing the uploaded file) genuinely documented, though the exact
--     shape of the `files` array entry is corroborated by third-party integration docs rather
--     than a spec, one notch below sevDesk's spec-verified confidence -- see the connector's
--     header comment.
--
-- Risk: invoices.finalize/void default to high/require_approval, the same tier as invoices.create
-- -- both produce a real, often-legally-binding document. invoices.record_payment defaults to
-- medium/require_approval -- a real bookkeeping event but not itself a new financial document.
-- contacts.update stays low/allow, matching contacts.create's existing precedent. products.update
-- defaults to medium/require_approval, the same tier products.create already has.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('invoices.finalize', 'invoices', 'high', 'Finalize a draft invoice, assigning it a real invoice number.',
   '{"type":"object","required":["integration_id","invoice_id"],"properties":{"integration_id":{"type":"string"},"invoice_id":{"type":"string"},"send_type":{"type":"string"}}}',
   ARRAY['sevdesk'], 'require_approval'),
  ('invoices.record_payment', 'invoices', 'medium', 'Record a payment against an invoice.',
   '{"type":"object","required":["integration_id","invoice_id","amount","check_account_id"],"properties":{"integration_id":{"type":"string"},"invoice_id":{"type":"string"},"amount":{"type":"number"},"check_account_id":{"type":"string"},"date":{"type":"string"}}}',
   ARRAY['sevdesk'], 'require_approval'),
  ('invoices.void', 'invoices', 'high', 'Cancel an invoice, creating a reversing cancellation invoice.',
   '{"type":"object","required":["integration_id","invoice_id"],"properties":{"integration_id":{"type":"string"},"invoice_id":{"type":"string"}}}',
   ARRAY['sevdesk'], 'require_approval'),
  ('contacts.update', 'contacts', 'low', 'Update an existing contact (customer or vendor) on a bookkeeping integration.',
   '{"type":"object","required":["integration_id","contact_id"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"},"name":{"type":"string"},"email":{"type":"string"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('products.update', 'products', 'medium', 'Update a product''s name, price, tax rate, or SKU.',
   '{"type":"object","required":["integration_id","product_id"],"properties":{"integration_id":{"type":"string"},"product_id":{"type":"string"},"name":{"type":"string"},"price":{"type":"number"},"tax_rate":{"type":"number"},"sku":{"type":"string"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = supported_platforms || ARRAY['lexoffice']
WHERE name = 'vouchers.create_from_file'
  AND NOT ('lexoffice' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'invoices.finalize/record_payment/void, contacts.update, products.update added 2026-09-03 -- confirmed against sevDesk''s own OpenAPI spec (api.sevdesk.de/openapi.yaml), not yet re-verified against a live account.'
  WHERE name = 'sevdesk';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'contacts.update, products.update added 2026-09-03 -- real, well-corroborated endpoints. vouchers.create_from_file also added -- a prior audit this session declined this as unconfirmable; re-researched and found real, though the exact `files` array shape is corroborated by third-party docs rather than an official spec (one notch below the other endpoints'' confidence). Not yet verified against a live account.'
  WHERE name = 'lexoffice';
