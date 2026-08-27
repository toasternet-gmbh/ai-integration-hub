-- Fifth e-commerce platform: JTL. LOW CONFIDENCE, same caveat class as datev.ts — "JTL" most
-- commonly means JTL-Wawi (the on-premise ERP most German merchants run), which has no public
-- REST API for orders the way WooCommerce/Shopify do. This connector instead targets JTL's own
-- Cloud "Platform APIs" (channel/marketplace sync), which is a materially different thing from
-- "connect my JTL shop" — see lib/connectors/jtl.ts's header comment for the full caveat.
--
-- Ships disabled (enabled=false) until connector tested against a real JTL channel/account.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('jtl', 'JTL', 'ecommerce', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'jtl')
WHERE name IN ('orders.search', 'orders.get', 'orders.refund', 'products.search', 'products.get', 'products.update_price', 'inventory.get_stock', 'inventory.update_stock')
  AND NOT ('jtl' = ANY(supported_platforms));
