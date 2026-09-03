-- Fourth and final item from this "audit lại" round: product variants/combinations CRUD, descoped
-- from the earlier product-CRUD round as the most complex due to per-platform model divergence.
-- Scoped this round to a search (read) tool only -- write mutations for variants (create/update a
-- specific variant's price/SKU/stock) need per-platform input shapes complex enough (Shopware's
-- own product-clone-then-configure flow, Magento's configurable-product option-attribute linking)
-- to warrant their own dedicated round rather than guessing.
--
-- products.variants.search: WooCommerce (GET /products/{id}/variations -- a real, separate
-- resource, unlike Shopify where variants are embedded on products.get), Magento (GET
-- /V1/configurable-products/{sku}/children), Shopware (POST /search/product filtered by
-- parentId -- Shopware has no nested /children path, a variant is just another product record),
-- PrestaShop (GET /combinations filtered by filter[id_product] -- PrestaShop's own name for
-- variants). Shopify and sevDesk/Lexoffice-style bookkeeping platforms are deliberately excluded:
-- Shopify's products.get already returns variants embedded on the product (see this tool's own
-- description), so a separate call adds nothing there.
--
-- Risk: low/allow, matching products.categories.search and every other read-only products.* tool
-- -- listing existing variant records has no real-world side effect.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('products.variants.search', 'products', 'low',
   'List the variants (e.g. different sizes/colors) of a product. Not needed on Shopify -- products.get already returns variants embedded on the product.',
   '{"type":"object","required":["integration_id","product_id"],"properties":{"integration_id":{"type":"string"},"product_id":{"type":"string"}}}',
   ARRAY['woocommerce', 'magento', 'shopware', 'prestashop'], 'allow')
ON CONFLICT (name) DO NOTHING;

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'products.variants.search added 2026-09-03 -- real, documented endpoint, not yet re-verified against a live account.'
  WHERE name IN ('woocommerce', 'magento', 'shopware', 'prestashop');
