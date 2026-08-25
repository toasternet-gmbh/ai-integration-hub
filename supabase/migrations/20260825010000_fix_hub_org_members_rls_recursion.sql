-- Fix: "Member select hub_organization_members" policy referenced hub_organization_members from
-- within its own USING clause (self-join), which Postgres evaluates as RLS-on-RLS recursion
-- ("infinite recursion detected in policy for relation hub_organization_members", 42P17). This also
-- broke every other policy that reads hub_organization_members indirectly (hub_organizations,
-- hub_subscriptions). Same fix already used for hub_projects: push the membership check into a
-- SECURITY DEFINER function, which runs as the function owner and bypasses RLS on the inner query.

CREATE OR REPLACE FUNCTION is_hub_org_member(p_organization_id UUID)
RETURNS BOOLEAN AS $$
DECLARE result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM hub_organization_members om WHERE om.organization_id = p_organization_id AND om.user_id = auth.uid()
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "Member select hub_organization_members" ON hub_organization_members;
CREATE POLICY "Member select hub_organization_members" ON hub_organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_hub_org_member(organization_id));
