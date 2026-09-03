-- Follow-up to 20260903000004: PrestaShop's connector previously only implemented orders/products
-- search+get, citing the webservice's XML-only write requirement as "more version-specific shapes
-- than this connector covers yet." Round-tripped live 2026-09-03 against a second, fresh local
-- PrestaShop 8 Docker store to actually confirm the write shapes (see lib/connectors/prestashop.ts
-- header comment for the full verification detail): products.update_price (PUT /products/{id}),
-- inventory.get_stock/update_stock (GET/PUT /stock_availables/{id}), orders.cancel (PUT
-- /orders/{id} current_state), and orders.refund (POST /order_slip) all confirmed working against
-- real demo data, not mocked.
--
-- orders.refund carries a known, confirmed limitation: the created order_slip document is real,
-- but PrestaShop's webservice does not update the order_detail rows' own refunded-quantity
-- tracking the way refunding through the back office does (matches
-- github.com/PrestaShop/PrestaShop/issues/33109) -- still require_approval, same tier as every
-- other platform's orders.refund.

UPDATE hub_tool_registry
SET supported_platforms = supported_platforms || ARRAY['prestashop']
WHERE name IN ('orders.refund', 'orders.cancel', 'products.update_price', 'inventory.get_stock', 'inventory.update_stock')
  AND NOT ('prestashop' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'products.update_price, inventory.get_stock/update_stock, orders.cancel, orders.refund added 2026-09-03 -- round-tripped live against a real local PrestaShop 8 Docker store (products/stock/order-state writes and order_slip creation all confirmed working). orders.refund has a known limitation: the order_slip document is created correctly but order_detail refunded-quantity tracking is not updated by the webservice (upstream PrestaShop bug).'
  WHERE name = 'prestashop';
