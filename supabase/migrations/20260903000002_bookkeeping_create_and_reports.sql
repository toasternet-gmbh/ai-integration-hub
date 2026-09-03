-- Founder audit: bookkeeping only exposed 4 read-only tools (invoices.search/get,
-- contacts.search/get) despite Lexoffice and sevDesk's real APIs supporting contact creation
-- (POST /v1/contacts, POST /Contact), invoice creation (POST /v1/invoices,
-- POST /Invoice/Factory/saveInvoice), and, for sevDesk specifically, a dedicated Report resource
-- (GET /Report/profitAndLoss) that Lexoffice has no equivalent for. DATEV is deliberately excluded
-- from all three -- it has no public sandbox to verify a write path against, on top of its
-- existing unverified status.
--
-- invoices.create defaults to require_approval, same risk tier as orders.refund -- it creates a
-- real, potentially legally-binding financial document. contacts.create and the read-only report
-- default to allow.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('contacts.create', 'contacts', 'low', 'Create a new contact (customer or vendor) on a bookkeeping integration.',
   '{"type":"object","required":["integration_id","name"],"properties":{"integration_id":{"type":"string"},"name":{"type":"string"},"email":{"type":"string"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('invoices.create', 'invoices', 'high', 'Create a new invoice on a bookkeeping integration.',
   '{"type":"object","required":["integration_id","contact_id","line_items"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"},"title":{"type":"string"},"line_items":{"type":"array"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'require_approval'),
  ('reports.profit_and_loss', 'reports', 'low', 'Get a profit and loss summary for a date range on a bookkeeping integration.',
   '{"type":"object","required":["integration_id","start_date","end_date"],"properties":{"integration_id":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"}}}',
   ARRAY['sevdesk'], 'allow')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'contacts.create/invoices.create added 2026-09-03 -- real endpoints, but exact request/response shapes are best-effort, not yet verified against a live account.'
  WHERE name = 'lexoffice';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'contacts.create/invoices.create/reports.profit_and_loss added 2026-09-03 -- real endpoints, but exact request/response shapes are best-effort, not yet verified against a live account.'
  WHERE name = 'sevdesk';
