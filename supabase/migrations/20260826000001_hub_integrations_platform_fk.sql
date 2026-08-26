-- hub_integrations.platform was a hardcoded CHECK enum (woocommerce/shopware/shopify/magento/
-- wordpress) — every new platform (lexoffice included) needed a migration touching this
-- constraint just to be nameable, on top of the hub_tool_registry/hub_platform_types rows that
-- actually describe it. Replace it with a foreign key into hub_platform_types, the catalog that
-- already is the single source of truth for "what platforms exist" (superadmin's Platforms page
-- manages it). A platform is connectable the moment it has a hub_platform_types row — no other
-- schema change needed for the next one.

ALTER TABLE hub_integrations DROP CONSTRAINT hub_integrations_platform_check;
ALTER TABLE hub_integrations
  ADD CONSTRAINT hub_integrations_platform_fkey FOREIGN KEY (platform) REFERENCES hub_platform_types(name);
