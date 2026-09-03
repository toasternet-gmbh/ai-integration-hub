-- Part of the exhaustive cross-platform re-audit: extends the existing products.create/
-- products.update tools (previously bookkeeping-only, Lexoffice/sevDesk) to the five e-commerce
-- connectors with confirmed, sufficiently-confident create/update endpoints -- Shopify, WooCommerce,
-- Magento, Shopware, PrestaShop -- and adds a new read-only products.categories.search/get pair,
-- confirmed real and documented on all five (Shopify calls them "collections").
--
-- JTL is deliberately NOT extended here. The same re-audit found the connector's hosts are simply
-- wrong (auth.jtl-software.com / api.jtl-software.com/platform/v1 don't match JTL's real, current
-- developer portal at developer.jtl-software.com), and that JTL's real Platform API is GraphQL
-- (api.jtl-cloud.com/erp/v2/graphql), not the REST surface this connector assumes throughout.
-- Bolting product-create onto a connector whose fundamental transport/host assumptions are wrong
-- would just be more wrong code on the same broken foundation -- that needs its own dedicated fix
-- (effectively a rewrite), not a bundled extension. JTL already ships disabled.
--
-- Variant/combination CRUD and category *assignment* (attaching a product to a category/
-- collection, distinct from just listing them) were also explicitly out of scope this round --
-- both are far more platform-divergent than plain product/category CRUD and would need
-- per-platform live verification this pass didn't have time for; products.get already returns
-- embedded variant data on most of these platforms as a partial mitigation.
--
-- PrestaShop's products.create/update were round-tripped live against a fresh Docker store (see
-- the connector's header comment); the other four platforms are confirmed against official docs
-- only, consistent with how their existing tools (orders.*, products.update_price) were verified.
--
-- Risk: products.create/update stay medium/require_approval, the same tier they already carry
-- for the bookkeeping platforms -- creating or editing a live storefront listing is a real,
-- customer-visible action. products.categories.search/get are pure reads, low/allow.

UPDATE hub_tool_registry
SET supported_platforms = supported_platforms || ARRAY['shopify', 'woocommerce', 'magento', 'shopware', 'prestashop']
WHERE name IN ('products.create', 'products.update')
  AND NOT ('shopify' = ANY(supported_platforms));

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('products.categories.search', 'products', 'low', 'Search the product categories/collections on an e-commerce integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['shopify', 'woocommerce', 'magento', 'shopware', 'prestashop'], 'allow'),
  ('products.categories.get', 'products', 'low', 'Get one product category/collection by id.',
   '{"type":"object","required":["integration_id","category_id"],"properties":{"integration_id":{"type":"string"},"category_id":{"type":"string"}}}',
   ARRAY['shopify', 'woocommerce', 'magento', 'shopware', 'prestashop'], 'allow')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'products.create/update, products.categories.search/get added 2026-09-03 -- real, documented endpoints, not yet re-verified against a live account.'
  WHERE name IN ('shopify', 'woocommerce', 'magento', 'shopware');

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'products.create/update, products.categories.search/get added 2026-09-03 -- round-tripped live against a fresh local PrestaShop 8 Docker store (see connector header comment for the position_in_category/link_rewrite findings).'
  WHERE name = 'prestashop';
