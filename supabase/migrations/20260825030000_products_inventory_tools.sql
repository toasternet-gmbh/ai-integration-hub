-- Registers the new products.* and inventory.* domain tools (backend handlers already added to
-- hub-mcp-server/tools/{products,inventory}.ts) in the Hub-wide gated tool catalog, alongside
-- the existing orders.* rows. Without a row here, resolvePermission() falls back to "deny" for
-- every one of these — the catalog row is what makes a tool grantable to an agent at all.

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('products.search', 'products', 'low', 'Search products on an integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['woocommerce','shopware','magento','shopify'], 'allow'),
  ('products.get', 'products', 'low', 'Get one product by id (on Magento, the SKU).',
   '{"type":"object","required":["integration_id","product_id"],"properties":{"integration_id":{"type":"string"},"product_id":{"type":"string"}}}',
   ARRAY['woocommerce','shopware','magento','shopify'], 'allow'),
  ('products.update_price', 'products', 'high', 'Update a product''s price.',
   '{"type":"object","required":["integration_id","product_id","price"],"properties":{"integration_id":{"type":"string"},"product_id":{"type":"string"},"price":{"type":"number"}}}',
   ARRAY['woocommerce','shopware','magento','shopify'], 'require_approval'),
  ('inventory.get_stock', 'inventory', 'low', 'Get a product''s current stock level.',
   '{"type":"object","required":["integration_id","product_id"],"properties":{"integration_id":{"type":"string"},"product_id":{"type":"string"}}}',
   ARRAY['woocommerce','shopware','magento','shopify'], 'allow'),
  ('inventory.update_stock', 'inventory', 'medium', 'Set a product''s stock quantity to an exact value (not a delta).',
   '{"type":"object","required":["integration_id","product_id","quantity"],"properties":{"integration_id":{"type":"string"},"product_id":{"type":"string"},"quantity":{"type":"number"}}}',
   ARRAY['woocommerce','shopware','magento','shopify'], 'require_approval')
ON CONFLICT (name) DO NOTHING;
