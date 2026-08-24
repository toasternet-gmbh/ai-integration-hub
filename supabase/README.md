# supabase/ in this repo

`migrations/` here is the original standalone-stack schema, kept only as a historical record for
the (stopped, not deleted) standalone Supabase stack this product used to run on its own.

There is no `functions/` directory here anymore. The Hub's edge function
(MCP gateway, connectors, policy engine, all tool handlers) now lives inside **yogaipilot's** repo at
`yogaipilot/supabase/functions/hub-mcp-server/`, deployed as part of yogaipilot's shared Supabase
instance — see `docs/access-and-accounts.md` in this repo for the full shared-database migration
writeup. Edit the code there, not here.
