-- Hub-wide catalog of e-commerce platform *types* (WooCommerce, Shopware, ...) — distinct from
-- hub_tool_registry (the catalog of *actions*, orders.search/products.get/...). This is what backs
-- the "Platforms" section of /superadmin/platforms: how many integrations of each platform exist
-- across the whole Hub, and a Hub-wide kill switch enforced in create_integration.

CREATE TABLE hub_platform_types (
  name TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO hub_platform_types (name, label) VALUES
  ('woocommerce', 'WooCommerce'),
  ('shopware', 'Shopware 6'),
  ('magento', 'Magento 2'),
  ('shopify', 'Shopify')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE hub_platform_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone select hub_platform_types" ON hub_platform_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all hub_platform_types" ON hub_platform_types FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT ON TABLE hub_platform_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_platform_types TO service_role;
