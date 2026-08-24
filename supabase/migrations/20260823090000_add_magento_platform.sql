-- Magento connector added — allow it through the integrations.platform check constraint.
ALTER TABLE integrations DROP CONSTRAINT integrations_platform_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_platform_check
  CHECK (platform IN ('woocommerce', 'shopware', 'shopify', 'magento', 'wordpress'));
