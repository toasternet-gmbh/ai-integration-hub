-- Two of the four items explicitly descoped from the earlier product-CRUD round: customer
-- addresses and product images. Both real, documented resources on Shopify/Magento/PrestaShop
-- (confirmed against official docs). WooCommerce and Shopware are deliberately NOT included:
-- WooCommerce embeds billing/shipping directly on the customer object rather than a separate
-- addresses resource (no real gap to close there beyond what contacts.get already returns);
-- Shopware's customer-address create needs a salutationId foreign-key reference this round didn't
-- have time to resolve safely (same category of problem as sevDesk's SevUser/StaticCountry gaps).
--
-- products.images.search/create: Shopify (base64 in the `attachment` JSON field), Magento (base64
-- in `entry.content.base64_encoded_data`), PrestaShop (genuine multipart upload, its one write
-- path that isn't XML). PrestaShop's two new tools are best-effort, not live-verified this round
-- (unlike its other writes, which were round-tripped against a real Docker store).
--
-- contacts.addresses.search/create: Shopify and PrestaShop have real dedicated address resources;
-- Magento's customer object already embeds an `addresses` array (search just reads that field),
-- and POST /V1/addresses is real for create. PrestaShop's `country` field is a caveat: it needs
-- that store's own internal numeric country id, not an ISO code like Shopify/Magento use for the
-- same field on this shared tool -- see the connector's own comment.
--
-- Risk: search tools default to low/allow. create tools default to medium/require_approval,
-- matching products.create/products.update's existing tier for these platforms -- editing a live
-- customer record or a live storefront listing's images is a real, customer-visible action.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('products.images.search', 'products', 'low', 'List the images on a product.',
   '{"type":"object","required":["integration_id","product_id"],"properties":{"integration_id":{"type":"string"},"product_id":{"type":"string"}}}',
   ARRAY['shopify', 'magento', 'prestashop'], 'allow'),
  ('products.images.create', 'products', 'medium', 'Upload a new image to a product.',
   '{"type":"object","required":["integration_id","product_id","file_base64","file_name"],"properties":{"integration_id":{"type":"string"},"product_id":{"type":"string"},"file_base64":{"type":"string"},"file_name":{"type":"string"},"mime_type":{"type":"string"}}}',
   ARRAY['shopify', 'magento', 'prestashop'], 'require_approval'),
  ('contacts.addresses.search', 'contacts', 'low', 'List the addresses on file for a contact (e-commerce customer).',
   '{"type":"object","required":["integration_id","contact_id"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"}}}',
   ARRAY['shopify', 'magento', 'prestashop'], 'allow'),
  ('contacts.addresses.create', 'contacts', 'medium', 'Add a new address to a contact (e-commerce customer).',
   '{"type":"object","required":["integration_id","contact_id","address1","city","zip","country"],"properties":{"integration_id":{"type":"string"},"contact_id":{"type":"string"},"first_name":{"type":"string"},"last_name":{"type":"string"},"company":{"type":"string"},"address1":{"type":"string"},"city":{"type":"string"},"zip":{"type":"string"},"country":{"type":"string"},"phone":{"type":"string"}}}',
   ARRAY['shopify', 'magento', 'prestashop'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'products.images.*, contacts.addresses.* added 2026-09-03 -- real, documented endpoints, not yet re-verified against a live account.'
  WHERE name IN ('shopify', 'magento');

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'products.images.*, contacts.addresses.* added 2026-09-03 -- real, documented endpoints, but best-effort/not live-verified this round (unlike this connector''s other writes, which were round-tripped against a real Docker store). contacts.addresses.create''s `country` field needs PrestaShop''s own internal numeric country id, not an ISO code.'
  WHERE name = 'prestashop';
