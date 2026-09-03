-- JTL connector rewrite, found necessary during the exhaustive re-audit: the previous
-- implementation targeted REST hosts (auth.jtl-software.com, api.jtl-software.com/platform/v1)
-- that don't match JTL's real developer portal. The real JTL Cloud API is GraphQL at
-- api.jtl-cloud.com/erp/v2/graphql -- confirmed this round against the official auto-generated
-- SDL schema reference (developer.jtl-software.com, fetched raw, 26,000 lines) and the official
-- auth guide. Also requires a previously-unknown `X-Tenant-ID` header alongside the bearer token,
-- so the credential shape gains a third field (tenantId).
--
-- Scope: reads only this round (orders.search/get, products.search/get, inventory.get_stock,
-- contacts.search/get) -- every query name and field used is copied directly from the real
-- schema. orders.refund/products.update_price/inventory.update_stock from the old (non-working)
-- connector are dropped rather than carried forward: real write mutations do exist, but their
-- input shapes are far more complex than could be confidently implemented this round.
--
-- Still ships disabled (schema-confirmed, not live-tested against a real JTL account).

UPDATE hub_tool_registry SET supported_platforms = array_remove(supported_platforms, 'jtl')
  WHERE name IN ('orders.refund', 'products.update_price', 'inventory.update_stock');

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['jtl']
  WHERE name IN ('contacts.search', 'contacts.get')
    AND NOT ('jtl' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'Rewritten 2026-09-03: previous REST implementation targeted wrong hosts entirely; real API is GraphQL (api.jtl-cloud.com/erp/v2/graphql), confirmed against the official schema reference. Scope reduced to reads (orders/products/inventory/contacts search+get) -- writes need a follow-up pass. Credential shape gained a required tenantId field (X-Tenant-ID header). Still schema-confirmed only, not live-tested against a real account -- stays disabled.'
  WHERE name = 'jtl';
