-- Founder-relayed follow-up to the e-commerce capability audit: contacts.search/contacts.get
-- (already generic — used by bookkeeping and CRM) turn out to be real, documented Customer
-- resources on every mainstream e-commerce platform too (Shopify GET /customers/search.json +
-- /customers/{id}.json, WooCommerce GET /customers, Magento GET /customers/search +
-- /customers/{id}, Shopware POST /search/customer + GET /customer/{id}, PrestaShop GET
-- /customers). Same tool, same dispatch code (tools/bookkeeping.ts) -- just new connector cases.
--
-- orders.cancel and orders.fulfill are new tools. Cancel is a real, distinct-from-refund endpoint
-- on Shopify/Magento/Shopware/WooCommerce (WooCommerce reuses its generic order-status PUT with
-- status=cancelled). Fulfill (mark shipped + attach a tracking number) is real and confirmed with
-- a genuine tracking-number field on Shopify/Magento/Shopware only -- WooCommerce core has no
-- tracking field at all (that needs a merchant-installed plugin with its own non-standard API), so
-- it's deliberately left off orders.fulfill's supported_platforms rather than faked. PrestaShop is
-- left off both for now -- see the follow-up PrestaShop-specific migration for its write-path work.
--
-- Risk: orders.cancel defaults to require_approval/high, same tier as orders.refund -- cancelling
-- can auto-trigger a refund on an already-captured payment (Shopify's documented default
-- behavior), so it carries the same financial blast radius. orders.fulfill defaults to
-- require_approval/medium -- no money moves, but it does send a real shipping-notification email
-- to the end customer, a real-world side effect worth a human glance before it fires.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('orders.cancel', 'orders', 'high', 'Cancel an unfulfilled order -- distinct from a refund, this stops the order rather than reversing a completed payment.',
   '{"type":"object","required":["integration_id","order_id"],"properties":{"integration_id":{"type":"string"},"order_id":{"type":"string"},"reason":{"type":"string"}}}',
   ARRAY['shopify', 'magento', 'shopware', 'woocommerce'], 'require_approval'),
  ('orders.fulfill', 'orders', 'medium', 'Mark an order as shipped and attach a tracking number.',
   '{"type":"object","required":["integration_id","order_id","tracking_number"],"properties":{"integration_id":{"type":"string"},"order_id":{"type":"string"},"tracking_number":{"type":"string"},"carrier":{"type":"string"},"tracking_url":{"type":"string"}}}',
   ARRAY['shopify', 'magento', 'shopware'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = supported_platforms || ARRAY['shopify', 'woocommerce', 'magento', 'shopware', 'prestashop']
WHERE name IN ('contacts.search', 'contacts.get')
  AND NOT ('shopify' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'contacts.search/get, orders.cancel, orders.fulfill added 2026-09-03 -- real, documented endpoints, not yet re-verified against a live account beyond the existing orders/products verification.'
  WHERE name IN ('shopify', 'magento', 'shopware');

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'contacts.search/get, orders.cancel added 2026-09-03 -- real, documented endpoints (no orders.fulfill: WooCommerce core has no tracking-number field), not yet re-verified against a live account.'
  WHERE name = 'woocommerce';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'contacts.search/get added 2026-09-03 -- real, documented /customers endpoint, same auth as the existing orders/products connector code.'
  WHERE name = 'prestashop';
