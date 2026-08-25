-- Platform-admin (superadmin) support — a role that sits above org/project membership entirely:
-- can see/manage every organization and user on the Hub, the hub-wide tool/platform catalog, and
-- Hub-wide settings. Distinct from hub_organization_members/hub_project_members.role ('owner' |
-- 'admin' | 'member'), which are always scoped to one org/project.
--
-- Enforcement lives in application code (hub-mcp-server/tools/platformAdmin.ts), not RLS — every
-- platform-admin tool call runs through the service-role client already (see lib/types.ts's
-- ToolContext comment), so the real gate is each handler's assertPlatformAdmin() check. RLS here is
-- still enabled, with service-role-only policies, as the same defense-in-depth posture already used
-- for hub_integrations.credentials_encrypted: nothing but the service role should ever touch these
-- tables directly.

CREATE TABLE hub_platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SECURITY DEFINER + plpgsql so it isn't inlined into a calling policy (same recursion-avoidance
-- reasoning as is_hub_project_member/is_hub_org_member) — not currently called by any RLS policy
-- below, but kept as the one documented, reusable definition of "is this user a platform admin",
-- in case a future feature needs a real RLS-level check instead of an application-layer one.
CREATE OR REPLACE FUNCTION is_hub_platform_admin() RETURNS BOOLEAN AS $$
DECLARE result BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM hub_platform_admins pa WHERE pa.user_id = auth.uid()) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

ALTER TABLE hub_platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role all hub_platform_admins" ON hub_platform_admins FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_platform_admins TO service_role;

-- ── Hub-wide settings (key/value, not tied to any organization/project) ────────────────────────

CREATE TABLE hub_platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_hub_platform_settings_updated_at BEFORE UPDATE ON hub_platform_settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE hub_platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role all hub_platform_settings" ON hub_platform_settings FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hub_platform_settings TO service_role;

-- ── Hard kill switch for a tool/platform, on top of the existing default_policy nuance ─────────
-- default_policy already lets an admin default a tool to 'deny', but agent-level overrides in
-- hub_agent_tool_permissions can still re-allow it per agent. `enabled = false` is meant to be a
-- true hub-wide off switch, checked first in resolvePermission() before any override is consulted.

ALTER TABLE hub_tool_registry ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;

-- ── Seed the first platform admin ───────────────────────────────────────────────────────────────
-- hub-test@yogaipilot.local is the existing local-dev test account (see docs/access-and-accounts.md).
-- Guarded so this migration stays safe to run in an environment where that user doesn't exist yet.

DO $$
DECLARE test_user_id UUID;
BEGIN
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'hub-test@yogaipilot.local';
  IF test_user_id IS NOT NULL THEN
    INSERT INTO hub_platform_admins (user_id) VALUES (test_user_id) ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;
