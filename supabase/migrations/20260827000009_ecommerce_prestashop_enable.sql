-- Enable the PrestaShop platform (added disabled in 20260827000007_ecommerce_prestashop.sql).
--
-- This is not just "reaches a real host" like the disabled note in that earlier migration
-- described — it's a genuine end-to-end verification done 2026-08-27: a real, live PrestaShop 8
-- store was stood up locally in Docker (`prestashop/prestashop:8-apache` + MySQL, unattended
-- install with real demo order/product data), its Webservice API was genuinely enabled with a
-- real generated webservice key (ps_configuration/ps_webservice_account/
-- ps_webservice_account_shop), and the Hub's own create_integration + orders.search/orders.get/
-- products.search/products.get tools were called for real against it — create_integration came
-- back status "connected" with real discovered capabilities, and all four tools returned real
-- demo-store data (see the connector's header comment in
-- supabase/functions/hub-mcp-server/lib/connectors/prestashop.ts for details). This is still
-- Docker demo data rather than a real customer's fully-authorized store, so it belongs in the
-- README's "reaches real API, not yet exercised against a real customer account" tier alongside
-- sevdesk/personio/etc., not the fully-unverified DATEV/JTL/TYPO3 tier.

UPDATE hub_platform_types SET enabled = true WHERE name = 'prestashop';
