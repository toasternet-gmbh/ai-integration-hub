-- Sixth e-commerce platform: PrestaShop, via its Webservice API. Only orders/products
-- search+get are registered (no refund/update_price/inventory yet — see
-- lib/connectors/prestashop.ts's header comment for why). Ships disabled (enabled=false) until
-- connector tested against a real PrestaShop store.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('prestashop', 'PrestaShop', 'ecommerce', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry
SET supported_platforms = array_append(supported_platforms, 'prestashop')
WHERE name IN ('orders.search', 'orders.get', 'products.search', 'products.get')
  AND NOT ('prestashop' = ANY(supported_platforms));
