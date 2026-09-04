-- Flip this session's newly-added connectors, plus GoCardless, from enabled:false to
-- enabled:true. This is an explicit founder decision to prioritize agent-facing MCP tool
-- availability over this project's usual "tested against a real, fully-authorized customer
-- account" bar before flipping a kill switch (the bar PrestaShop's enable flip in
-- 20260827000009_ecommerce_prestashop_enable.sql did meet). It does NOT mean these connectors
-- are now verified -- see CLAUDE.md's "Known gaps" section for what's still actually unconfirmed
-- per platform. DATEV, JTL, TYPO3, and Magento's pre-existing verification gaps are untouched by
-- this migration.
UPDATE hub_platform_types SET enabled = true
WHERE name IN (
  'pipedrive', 'monday', 'clockin', 'clockodo',
  'weclapp', 'billwerk', 'papershift', '123erfasst', 'openhandwerk',
  'outlook', 'google',
  'browserless', 'steel',
  'beeper',
  'gocardless'
);
