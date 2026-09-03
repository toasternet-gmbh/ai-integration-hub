-- Follow-up to 20260903000002: founder asked whether bookkeeping platforms support creating
-- products, and whether the new create tools support attaching an image. Research found:
--   - products.create is real on both Lexoffice (POST /v1/articles) and sevDesk (POST /Part) --
--     added as a shared products.* canonical tool (not bookkeeping-specific) so an e-commerce
--     connector can adopt the same tool name later without a new migration.
--   - Image/receipt attachment is a genuinely different concept from invoices.create/
--     contacts.create -- it maps to sevDesk's real two-step voucher upload flow
--     (POST /Voucher/Factory/uploadTempFile then POST /Voucher/Factory/saveVoucher). Lexoffice's
--     equivalent voucher-creation endpoint could not be confirmed with even best-effort confidence
--     this session (unlike its other endpoints, which all follow one consistent, verified
--     convention), so it is deliberately left out here rather than guessed.
--
-- Both new tools default to require_approval, same risk tier as products.update_price/
-- inventory.update_stock -- creating a priced catalog item or a bookkeeping record from an
-- untested write path both carry real financial-adjacent risk.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('products.create', 'products', 'medium', 'Create a new product on an integration.',
   '{"type":"object","required":["integration_id","name","price"],"properties":{"integration_id":{"type":"string"},"name":{"type":"string"},"price":{"type":"number"},"tax_rate":{"type":"number"},"sku":{"type":"string"}}}',
   ARRAY['lexoffice', 'sevdesk'], 'require_approval'),
  ('vouchers.create_from_file', 'vouchers', 'medium', 'Book an expense by uploading a receipt or bill as a voucher on a bookkeeping integration.',
   '{"type":"object","required":["integration_id","file_base64","file_name"],"properties":{"integration_id":{"type":"string"},"file_base64":{"type":"string"},"file_name":{"type":"string"},"mime_type":{"type":"string"},"description":{"type":"string"}}}',
   ARRAY['sevdesk'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'products.create added 2026-09-03 -- real endpoint, best-effort body shape, not yet verified against a live account.'
  WHERE name = 'lexoffice';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'products.create/vouchers.create_from_file added 2026-09-03 -- real endpoints, best-effort body shapes, not yet verified against a live account.'
  WHERE name = 'sevdesk';
