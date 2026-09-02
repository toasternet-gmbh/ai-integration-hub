-- Verification status has, until now, existed only as prose in CLAUDE.md's "Known gaps" section
-- and in individual migration comments (e.g. 20260827000009_ecommerce_prestashop_enable.sql) —
-- nowhere queryable, and nowhere a platform admin could update without a fresh migration. This
-- adds it as real, editable state on hub_platform_types, using the two tiers this project has
-- already been using consistently in its own docs/commits:
--   'unverified'    — never confirmed to reach the provider's real API (datev/jtl/typo3's caveat).
--   'api_verified'  — confirmed against the provider's real API (a real HTTP round-trip, e.g. a
--                     real 401 from the real host), but not yet exercised end-to-end against a
--                     real, fully-authorized customer account.
--   'real_customer_verified' — reserved for the bar CLAUDE.md describes as not yet cleared by any
--                     platform; no row uses it today, but the column accepts it so a future
--                     migration (or admin_set_platform_verification) can flip a platform into it
--                     without another schema change.
-- `verification_note` carries the free-text nuance this project already writes in migration
-- comments for cases that need it (e.g. PrestaShop/WooCommerce/Shopware went further than a bare
-- API round-trip, Magento's status was never actually confirmed despite shipping enabled).

ALTER TABLE hub_platform_types
  ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'api_verified', 'real_customer_verified')),
  ADD COLUMN verification_note TEXT;

-- Verified end-to-end (create_integration -> policy engine -> require_approval -> approve ->
-- real refund) against a live, self-hosted test store — see commit 9d730f0 ("Add Shopware
-- connector; fix live-testing bugs; verify full E2E on real stores"). Not yet a real customer's
-- own store, so still api_verified, not real_customer_verified.
UPDATE hub_platform_types SET verification_status = 'api_verified', verification_note =
  'Verified end-to-end (create_integration -> policy engine -> require_approval -> approve -> real refund) against a live, self-hosted WooCommerce test store. Not yet exercised against a real customer''s own store.'
  WHERE name = 'woocommerce';
UPDATE hub_platform_types SET verification_status = 'api_verified', verification_note =
  'Verified end-to-end (OAuth2 client_credentials, order refund via the order-transaction state machine) against a live, self-hosted Shopware 6 test instance. Not yet exercised against a real customer''s own store.'
  WHERE name = 'shopware';

-- No verification evidence exists anywhere (no commit, no prior doc) despite shipping
-- enabled=true since the very first hub_platform_types migration -- flagged 2026-09-02 while
-- adding this column. Left enabled (a business call, not this migration's to make) but marked
-- unverified so the gap is visible instead of silently assumed away.
UPDATE hub_platform_types SET verification_status = 'unverified', verification_note =
  'No verification evidence found in commit history or prior docs, despite shipping enabled=true since the original hub_platform_types migration. Flagged 2026-09-02 -- confirm against a real Magento store before relying on it.'
  WHERE name = 'magento';

-- The "reaches the real provider API, not yet a real customer account" tier CLAUDE.md already
-- describes as a single group.
UPDATE hub_platform_types SET verification_status = 'api_verified'
  WHERE name IN ('shopify', 'lexoffice', 'wordpress', 'toggl', 'gocardless', 'sevdesk', 'personio', 'contentful', 'clockify', 'hubspot');

-- Went further than the rest of the api_verified group (a real, live local store round-tripped
-- through the whole Hub pipeline, not just a raw API call) per
-- 20260827000009_ecommerce_prestashop_enable.sql -- but that migration deliberately keeps it in
-- the same tier as sevdesk/personio/etc, not a new one, so this mirrors that call.
UPDATE hub_platform_types SET verification_status = 'api_verified', verification_note =
  'Round-tripped against a real, live local PrestaShop 8 store in Docker with a genuine webservice key -- create_integration and orders.search/orders.get/products.search/products.get all returned real demo order/product data. Furthest along of the api_verified group, but still Docker demo data, not a real customer''s own store.'
  WHERE name = 'prestashop';

-- Never confirmed to reach the provider's real API at all -- see each connector's header comment.
UPDATE hub_platform_types SET verification_status = 'unverified', verification_note =
  'Requires DATEV Marktplatz partner certification (no public sandbox) -- endpoint shape is best-effort, inferred from public docs, never called for real.'
  WHERE name = 'datev';
UPDATE hub_platform_types SET verification_status = 'unverified', verification_note =
  'Targets JTL''s Cloud "Platform APIs" (channel/marketplace sync) -- the real API host could not be confirmed through public research; the guessed one is known wrong.'
  WHERE name = 'jtl';
UPDATE hub_platform_types SET verification_status = 'unverified', verification_note =
  'TYPO3 core has no built-in REST API for content -- only works against a site running a specific community extension (cundd/rest), which has never been tested against.'
  WHERE name = 'typo3';
