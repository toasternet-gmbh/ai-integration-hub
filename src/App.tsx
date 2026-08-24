import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { AppShell } from "./components/AppShell";

const Landing = lazy(() => import("./pages/Landing"));
const SignIn = lazy(() => import("./pages/SignIn"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Agents = lazy(() => import("./pages/Agents"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Audit = lazy(() => import("./pages/Audit"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));
const Billing = lazy(() => import("./pages/Billing"));
const Team = lazy(() => import("./pages/Team"));
const Account = lazy(() => import("./pages/Account"));
const Help = lazy(() => import("./pages/Help"));
const HelpArticle = lazy(() => import("./pages/HelpArticle"));
const Imprint = lazy(() => import("./pages/Imprint"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

function PageFallback() {
  return <div className="min-h-screen flex items-center justify-center font-body-md text-on-surface-variant">Loading…</div>;
}

type Session = { user: { id: string; email?: string } } | null;
type ProjectSelection = { orgId: string; orgName: string; projectId: string; projectName: string };

const STORAGE_KEY = "hub_project_selection";

export default function App() {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session as Session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s as Session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-body-md text-on-surface-variant">Loading…</div>;

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={session ? <Navigate to="/app" replace /> : <SignIn />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/imprint" element={<Imprint />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/help" element={<Help />} />
        <Route path="/help/:slug" element={<HelpArticle />} />
        <Route path="/app/*" element={session ? <AuthedArea /> : <Navigate to="/signin" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function AuthedArea() {
  const navigate = useNavigate();
  const [selection, setSelection] = useState<ProjectSelection | null>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { return null; }
  });

  function onOnboarded(orgId: string, orgName: string, projectId: string, projectName: string) {
    const next = { orgId, orgName, projectId, projectName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSelection(next);
  }

  function switchProject() {
    localStorage.removeItem(STORAGE_KEY);
    setSelection(null);
    navigate("/app");
  }

  if (!selection) return <Onboarding onDone={onOnboarded} />;

  return (
    <AppShell orgName={selection.orgName} projectName={selection.projectName} onSwitchProject={switchProject}>
      <Routes>
        <Route element={<ProjectContext projectId={selection.projectId} organizationId={selection.orgId} />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="agents" element={<Agents />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="audit" element={<Audit />} />
          <Route path="api-keys" element={<ApiKeys />} />
          <Route path="billing" element={<Billing />} />
          <Route path="team" element={<Team />} />
          <Route path="account" element={<Account />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </AppShell>
  );
}

function ProjectContext({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  return <Outlet context={{ projectId, organizationId }} />;
}
