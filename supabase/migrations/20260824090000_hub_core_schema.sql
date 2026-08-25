-- AI Integration Hub — core schema, real migration (supersedes the historical, never-applied
-- migrations_archive/20260823000000_core_schema.sql + 20260823090000_add_magento_platform.sql).
-- Every table here is prefixed `hub_` because this project is applied to the same shared Supabase
-- project as yogaipilot (see supabase/README.md) — must not collide with yogaipilot's own
-- `organizations`, `agents`, `integrations`, `api_keys`, etc.
--
-- Organization -> Project -> {Integration, Agent, ApiKey}. RLS checks membership via a join table
-- rather than a single "current tenant" helper, since one user can belong to many
-- organizations/projects (unlike yogaipilot's one-profile-one-tenant model).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Organizations & membership ──────────────────────────────────────────────────────────────────

CREATE TABLE hub_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hub_organization_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES hub_organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

-- ── Projects & membership ───────────────────────────────────────────────────────────────────────

CREATE TABLE hub_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES hub_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hub_projects_org ON hub_projects (organization_id);

CREATE TABLE hub_project_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

-- `is_hub_project_admin(project_id)` — SECURITY DEFINER + plpgsql so it isn't inlined into the
-- calling policy (avoids the same self-referential-policy recursion yogaipilot's is_admin_role()
-- avoids).
CREATE OR REPLACE FUNCTION is_hub_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM hub_project_members pm WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_hub_project_admin(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM hub_project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ── Integrations (a connection to one external platform) ───────────────────────────────────────

CREATE TABLE hub_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('woocommerce', 'shopware', 'shopify', 'magento', 'wordpress')),
  name TEXT NOT NULL,
  -- Encrypted at the application layer (AES-256-GCM, see _shared/crypto.ts) before insert — this
  -- column never holds plaintext credentials, and no policy below grants it to non-service-role
  -- reads (see the "no client select" note under RLS).
  credentials_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error')),
  capabilities JSONB NOT NULL DEFAULT '[]',
  last_sync_at TIMESTAMPTZ,
  error_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hub_integrations_project ON hub_integrations (project_id);
CREATE TRIGGER trg_hub_integrations_updated_at BEFORE UPDATE ON hub_integrations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Agents ───────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE hub_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hub_agents_project ON hub_agents (project_id);

-- ── Tool registry (platform-wide catalog, not project-scoped) ──────────────────────────────────

CREATE TABLE hub_tool_registry (
  name TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  risk TEXT NOT NULL DEFAULT 'low' CHECK (risk IN ('low', 'medium', 'high')),
  description TEXT,
  input_schema JSONB NOT NULL DEFAULT '{}',
  supported_platforms TEXT[] NOT NULL DEFAULT '{}',
  default_policy TEXT NOT NULL DEFAULT 'allow' CHECK (default_policy IN ('allow', 'deny', 'require_approval'))
);

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('orders.search', 'orders', 'low', 'Search orders on an integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"status":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['woocommerce','shopware'], 'allow'),
  ('orders.get', 'orders', 'low', 'Get one order by id.',
   '{"type":"object","required":["integration_id","order_id"],"properties":{"integration_id":{"type":"string"},"order_id":{"type":"string"}}}',
   ARRAY['woocommerce','shopware'], 'allow'),
  ('orders.refund', 'orders', 'high', 'Refund an existing order (full or partial).',
   '{"type":"object","required":["integration_id","order_id"],"properties":{"integration_id":{"type":"string"},"order_id":{"type":"string"},"amount":{"type":"number"},"reason":{"type":"string"}}}',
   ARRAY['woocommerce','shopware'], 'require_approval')
ON CONFLICT (name) DO NOTHING;

-- ── Agent tool permissions (most-specific-wins: (agent,tool,integration) -> (agent,tool) -> (agent,'*')) ──

CREATE TABLE hub_agent_tool_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES hub_agents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  integration_id UUID REFERENCES hub_integrations(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'deny' CHECK (permission IN ('allow', 'deny', 'require_approval')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, tool_name, integration_id)
);
CREATE INDEX idx_hub_agent_tool_perms ON hub_agent_tool_permissions (project_id, agent_id, tool_name);

-- ── Action approvals (approve = execute now, not a retry-unlock) ───────────────────────────────

CREATE TABLE hub_action_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES hub_agents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  integration_id UUID NOT NULL REFERENCES hub_integrations(id) ON DELETE CASCADE,
  input JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'denied', 'approved', 'executed')),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hub_action_approvals_inbox ON hub_action_approvals (project_id, status, created_at DESC);

-- ── Audit log ────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE hub_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES hub_agents(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  integration_id UUID REFERENCES hub_integrations(id) ON DELETE SET NULL,
  input JSONB,
  status TEXT NOT NULL CHECK (status IN ('allowed', 'denied', 'require_approval', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hub_audit_logs_project ON hub_audit_logs (project_id, created_at DESC);

-- ── API keys (project-scoped; used by external AI apps calling the MCP gateway) ────────────────

CREATE TABLE hub_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hub_api_keys_project ON hub_api_keys (project_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────────────────────────
-- Every project-scoped table: SELECT/INSERT/UPDATE/DELETE gated on is_hub_project_member(project_id)
-- (mutations further gated on is_hub_project_admin where the action is administrative). Service role
-- bypasses everything (mcp-server always uses the service-role client for tool execution).
--
-- `hub_integrations.credentials_encrypted` is never selected by a policy scoped to "member" alone in
-- application code (mcp-server/tools/integrations.ts's list handler omits the column) — RLS can't
-- enforce column-level omission, so this is an application-layer discipline, same posture as
-- yogaipilot's mcpAuth.ts comment about credentials never reaching the client.

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['hub_integrations', 'hub_agents', 'hub_agent_tool_permissions', 'hub_action_approvals', 'hub_audit_logs', 'hub_api_keys'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Member select %1$s" ON %1$I', tbl);
    EXECUTE format('CREATE POLICY "Member select %1$s" ON %1$I FOR SELECT TO authenticated USING (is_hub_project_member(project_id))', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admin write %1$s" ON %1$I', tbl);
    EXECUTE format('CREATE POLICY "Admin write %1$s" ON %1$I FOR ALL TO authenticated USING (is_hub_project_admin(project_id)) WITH CHECK (is_hub_project_admin(project_id))', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Service role all %1$s" ON %1$I', tbl);
    EXECUTE format('CREATE POLICY "Service role all %1$s" ON %1$I FOR ALL USING (auth.role() = ''service_role'')', tbl);
    EXECUTE format('GRANT SELECT ON TABLE %I TO authenticated', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO service_role', tbl);
  END LOOP;
END $$;

ALTER TABLE hub_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member select hub_organizations" ON hub_organizations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hub_organization_members om WHERE om.organization_id = hub_organizations.id AND om.user_id = auth.uid()));
CREATE POLICY "Service role all hub_organizations" ON hub_organizations FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT ON TABLE hub_organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_organizations TO service_role;

ALTER TABLE hub_organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member select hub_organization_members" ON hub_organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM hub_organization_members om WHERE om.organization_id = hub_organization_members.organization_id AND om.user_id = auth.uid()));
CREATE POLICY "Service role all hub_organization_members" ON hub_organization_members FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT ON TABLE hub_organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_organization_members TO service_role;

ALTER TABLE hub_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member select hub_projects" ON hub_projects FOR SELECT TO authenticated USING (is_hub_project_member(id));
CREATE POLICY "Service role all hub_projects" ON hub_projects FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT ON TABLE hub_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_projects TO service_role;

ALTER TABLE hub_project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member select hub_project_members" ON hub_project_members FOR SELECT TO authenticated USING (is_hub_project_member(project_id));
CREATE POLICY "Service role all hub_project_members" ON hub_project_members FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT ON TABLE hub_project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_project_members TO service_role;

ALTER TABLE hub_tool_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone select hub_tool_registry" ON hub_tool_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all hub_tool_registry" ON hub_tool_registry FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT ON TABLE hub_tool_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_tool_registry TO service_role;
