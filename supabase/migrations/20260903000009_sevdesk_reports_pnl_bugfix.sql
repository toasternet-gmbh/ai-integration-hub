-- Bug fix, found while doing an exhaustive (not top-N) re-audit of every connected platform:
-- reports.profit_and_loss (sevDesk-only) has called GET /Report/profitAndLoss since it shipped
-- (20260827000000_bookkeeping_sevdesk.sql), documented at the time as "a real, confirmed
-- endpoint." That was wrong. Cross-checked this round against sevDesk's own official OpenAPI spec
-- (api.sevdesk.de/openapi.yaml, fetched and grepped in full, twice independently) and that path
-- does not exist anywhere in it. sevDesk's only /Report/* endpoints are CSV list exports
-- (invoicelist/orderlist/contactlist/voucherlist) -- the Gewinn-und-Verlustrechnung (P&L) is a
-- web-UI-only feature (see hilfe.sevdesk.de/de/articles/9310611-gewinn-und-verlustrechnung),
-- with no documented API. Every real call this tool ever made would have 404'd.
--
-- Removing the tool outright (not just hiding it) -- supported_platforms is discovery-only, not
-- an execution gate (see index.ts's tools/list handler), so leaving the row behind with an empty
-- supported_platforms would still let the connector dispatch it (and it no longer has a case to
-- dispatch to, since the connector code was removed in the same commit). No replacement endpoint
-- exists to reimplement this against.

DELETE FROM hub_tool_registry WHERE name = 'reports.profit_and_loss';

UPDATE hub_platform_types SET verification_note = COALESCE(verification_note || ' ', '') ||
  'reports.profit_and_loss removed 2026-09-03 -- confirmed against the official OpenAPI spec that no such endpoint exists; every call would have 404d.'
  WHERE name = 'sevdesk';
