-- Part of the exhaustive cross-platform re-audit: adds the sales-document types both bookkeeping
-- platforms document but this Hub had no tools for at all -- quotations (Angebote), order
-- confirmations (Auftragsbestätigungen), delivery notes (Lieferscheine), and credit notes
-- (Gutschriften/Stornorechnungen).
--
-- Lexoffice: each is its own REST resource (POST/GET /v1/quotations, /v1/order-confirmations,
-- /v1/delivery-notes, /v1/credit-notes), confirmed real via developers.lexware.io. All default to
-- draft creation, same conservative posture as invoices.create. credit_notes.create is Lexoffice's
-- ONLY way to correct/reverse an invoice (Lexoffice invoices have no void/cancel API at all) --
-- pass preceding_invoice_id to reverse a specific invoice, or omit it for a standalone credit note.
--
-- sevDesk: quotes/order_confirmations/delivery_notes are all backed by one unified /Order resource
-- (orderType enum AN/AB/LI, confirmed in the OpenAPI spec's Model_Order) -- search/get only.
-- Standalone creation of an Order OR a standalone CreditNote both require addressCountry
-- (StaticCountry) and contactPerson (SevUser) references that the OpenAPI spec has no listable
-- endpoint for -- no safe way to resolve a real id without guessing, so create is NOT implemented
-- for the Order trio on sevDesk, and credit_notes.create on sevDesk only supports the
-- createFromInvoice path (preceding_invoice_id is effectively required there, even though the
-- shared tool schema doesn't enforce that per-platform difference).
--
-- Risk: search/get default to low/allow, same as every other read tool. quotes.create/
-- order_confirmations.create/delivery_notes.create default to medium/require_approval -- real
-- customer-facing documents, but not themselves a financial obligation the way an invoice is.
-- credit_notes.create defaults to high/require_approval, the same tier as invoices.create/void --
-- it directly reverses money owed.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('quotes.search', 'quotes', 'low', 'Search quotations on a bookkeeping integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"page":{"type":"number"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('quotes.get', 'quotes', 'low', 'Get one quotation by id.',
   '{"type":"object","required":["integration_id","quote_id"],"properties":{"integration_id":{"type":"string"},"quote_id":{"type":"string"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('quotes.create', 'quotes', 'medium', 'Create a new quotation on a bookkeeping integration.',
   '{"type":"object","required":["integration_id","contact_id","line_items"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"},"title":{"type":"string"},"line_items":{"type":"array"}}}',
   ARRAY['lexoffice'], 'require_approval'),
  ('order_confirmations.search', 'order_confirmations', 'low', 'Search order confirmations on a bookkeeping integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"page":{"type":"number"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('order_confirmations.get', 'order_confirmations', 'low', 'Get one order confirmation by id.',
   '{"type":"object","required":["integration_id","order_confirmation_id"],"properties":{"integration_id":{"type":"string"},"order_confirmation_id":{"type":"string"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('order_confirmations.create', 'order_confirmations', 'medium', 'Create a new order confirmation on a bookkeeping integration.',
   '{"type":"object","required":["integration_id","contact_id","line_items"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"},"title":{"type":"string"},"line_items":{"type":"array"}}}',
   ARRAY['lexoffice'], 'require_approval'),
  ('delivery_notes.search', 'delivery_notes', 'low', 'Search delivery notes on a bookkeeping integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"page":{"type":"number"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('delivery_notes.get', 'delivery_notes', 'low', 'Get one delivery note by id.',
   '{"type":"object","required":["integration_id","delivery_note_id"],"properties":{"integration_id":{"type":"string"},"delivery_note_id":{"type":"string"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('delivery_notes.create', 'delivery_notes', 'medium', 'Create a new delivery note on a bookkeeping integration.',
   '{"type":"object","required":["integration_id","contact_id","line_items"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"},"title":{"type":"string"},"line_items":{"type":"array"}}}',
   ARRAY['lexoffice'], 'require_approval'),
  ('credit_notes.search', 'credit_notes', 'low', 'Search credit notes on a bookkeeping integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"page":{"type":"number"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('credit_notes.get', 'credit_notes', 'low', 'Get one credit note by id.',
   '{"type":"object","required":["integration_id","credit_note_id"],"properties":{"integration_id":{"type":"string"},"credit_note_id":{"type":"string"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'allow'),
  ('credit_notes.create', 'credit_notes', 'high', 'Create a credit note -- either reversing a specific invoice (preceding_invoice_id) or standalone from line items.',
   '{"type":"object","required":["integration_id","contact_id"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"},"title":{"type":"string"},"preceding_invoice_id":{"type":"string"},"line_items":{"type":"array"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'quotes/order_confirmations/delivery_notes/credit_notes added 2026-09-03 -- real, documented endpoints (developers.lexware.io), not yet re-verified against a live account. delivery_notes.search''s voucherType filter value ("deliverynote") is inferred by naming convention, lower confidence than the other three.'
  WHERE name = 'lexoffice';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'quotes/order_confirmations/delivery_notes (search/get only) and credit_notes (search/get/create via createFromInvoice only) added 2026-09-03 -- confirmed against the official OpenAPI spec. Standalone creation of any of these was deliberately not implemented: it requires addressCountry/contactPerson references with no listable lookup endpoint in the spec.'
  WHERE name = 'sevdesk';
