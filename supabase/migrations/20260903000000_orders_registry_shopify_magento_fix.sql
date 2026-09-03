-- Bug found in a platform-coverage audit: hub_core_schema.sql's original orders.search/orders.get/
-- orders.refund rows only listed supported_platforms = {woocommerce, shopware} -- shopify and
-- magento were never appended, even though both connectors (lib/connectors/shopify.ts,
-- lib/connectors/magento.ts) implement and advertise all three orders.* tools via
-- getCapabilities(), and the sibling products.*/inventory.* rows (20260825030000_products_
-- inventory_tools.sql) correctly included all four e-commerce platforms from the start. Net
-- effect: tools/list's supported_platforms field (and superadmin's Tool catalog) under-reported
-- Shopify/Magento order support -- the calls themselves were never blocked by this (policy
-- resolution doesn't gate on supported_platforms), just the discovery metadata was wrong.

UPDATE hub_tool_registry
SET supported_platforms = supported_platforms || ARRAY['shopify', 'magento']
WHERE name IN ('orders.search', 'orders.get', 'orders.refund')
  AND NOT ('shopify' = ANY(supported_platforms));
