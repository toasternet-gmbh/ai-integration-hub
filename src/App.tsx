import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { mcp } from "./lib/mcp";
import { AppShell } from "./components/AppShell";
import { SuperAdminShell } from "./components/SuperAdminShell";
import { I18nProvider, preferredLang, useI18n, type Lang } from "./lib/i18n";
import { usePlatformAdmin } from "./lib/usePlatformAdmin";

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
const Blueprint = lazy(() => import("./pages/Blueprint"));
const Help = lazy(() => import("./pages/Help"));
const HelpArticle = lazy(() => import("./pages/HelpArticle"));
const Imprint = lazy(() => import("./pages/Imprint"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const SuperAdminOverview = lazy(() => import("./pages/superadmin/Overview"));
const SuperAdminOrganizations = lazy(() => import("./pages/superadmin/Organizations"));
const SuperAdminUsers = lazy(() => import("./pages/superadmin/Users"));
const SuperAdminPlatforms = lazy(() => import("./pages/superadmin/Platforms"));
const SuperAdminAdmins = lazy(() => import("./pages/superadmin/Admins"));
const SuperAdminSettings = lazy(() => import("./pages/superadmin/Settings"));

function PageFallback() {
  return <div className="min-h-screen flex items-center justify-center font-body-md text-on-surface-variant">Loading…</div>;
}

type Session = { user: { id: string; email?: string } } | null;
type ProjectSelection = { orgId: string; orgName: string; projectId: string; projectName: string };

/** Scoped per user id — otherwise a second account signing in on the same browser (e.g. a
 * platform admin with no org membership) would inherit the previous account's project selection
 * and immediately hit "Not a member of project ..." trying to load data for it. */
function storageKey(userId: string) {
  return `hub_project_selection:${userId}`;
}

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
        <Route path="/" element={<Navigate to={`/${preferredLang()}`} replace />} />
        <Route path="/:lang/*" element={<LocalizedApp session={session} />} />
        {/* Bare, un-prefixed paths (old links/bookmarks from before language-prefixed URLs) —
         * redirect to the same page under the preferred language instead of 404ing. */}
        <Route path="/signin" element={<LegacyRedirect />} />
        <Route path="/reset-password" element={<LegacyRedirect />} />
        <Route path="/imprint" element={<LegacyRedirect />} />
        <Route path="/privacy" element={<LegacyRedirect />} />
        <Route path="/terms" element={<LegacyRedirect />} />
        <Route path="/help" element={<LegacyRedirect />} />
        <Route path="/help/:slug" element={<LegacyRedirect />} />
        <Route path="/app/*" element={<LegacyRedirect />} />
        <Route path="/superadmin/*" element={<LegacyRedirect />} />
        <Route path="*" element={<Navigate to={`/${preferredLang()}`} replace />} />
      </Routes>
    </Suspense>
  );
}

/** Redirects an old, un-prefixed URL (e.g. `/help`) to its `/en/help` or `/de/help` equivalent.
 * Keeps the hash too — GoTrue's password-recovery links carry the session token in the fragment,
 * which would otherwise get silently dropped by this redirect. */
function LegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/${preferredLang()}${location.pathname}${location.search}${location.hash}`} replace />;
}

/** Everything under `/:lang/*` — validates the language segment, makes it the source of truth for
 * `useI18n()`, and renders the app's real routes (relative to this prefix) underneath it. */
function LocalizedApp({ session }: { session: Session }) {
  const { lang: rawLang } = useParams<{ lang: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const restPath = location.pathname.split("/").slice(2).join("/");

  useEffect(() => {
    if (rawLang === "en" || rawLang === "de") localStorage.setItem("hub_lang", rawLang);
  }, [rawLang]);

  if (rawLang !== "en" && rawLang !== "de") {
    return <Navigate to={`/${preferredLang()}${restPath ? `/${restPath}` : ""}${location.search}${location.hash}`} replace />;
  }
  const lang = rawLang as Lang;
  const setLang = (l: Lang) => navigate(`/${l}${restPath ? `/${restPath}` : ""}${location.search}${location.hash}`);

  return (
    <I18nProvider lang={lang} setLang={setLang}>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="signin" element={session ? <PostSignInRedirect lang={lang} /> : <SignIn />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="imprint" element={<Imprint />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="blueprint" element={<Blueprint />} />
        <Route path="help" element={<Help />} />
        <Route path="help/:slug" element={<HelpArticle />} />
        <Route path="app/*" element={session ? <AuthedArea session={session} /> : <Navigate to={`/${lang}/signin`} replace />} />
        <Route path="superadmin/*" element={session ? <SuperAdminGate /> : <Navigate to={`/${lang}/signin`} replace />} />
        <Route path="*" element={<Navigate to={`/${lang}`} replace />} />
      </Routes>
    </I18nProvider>
  );
}

/** A platform admin has no org membership of their own, so `/app` has nothing to show them —
 * send them straight to `/superadmin` instead. Everyone else goes to `/app` as before. */
function PostSignInRedirect({ lang }: { lang: Lang }) {
  const isAdmin = usePlatformAdmin();
  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center font-body-md text-on-surface-variant">Loading…</div>;
  return <Navigate to={`/${lang}/${isAdmin ? "superadmin" : "app"}`} replace />;
}

/** Guards /superadmin/*: only a platform admin gets past the loading state, everyone else is
 * bounced back into their own Hub area — this is Hub-wide, not something to leave half-visible. */
function SuperAdminGate() {
  const { path } = useI18n();
  const isAdmin = usePlatformAdmin();

  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center font-body-md text-on-surface-variant">Loading…</div>;
  if (isAdmin === false) return <Navigate to={path("/app")} replace />;

  return (
    <SuperAdminShell>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<SuperAdminOverview />} />
        <Route path="organizations" element={<SuperAdminOrganizations />} />
        <Route path="users" element={<SuperAdminUsers />} />
        <Route path="platforms" element={<SuperAdminPlatforms />} />
        <Route path="admins" element={<SuperAdminAdmins />} />
        <Route path="settings" element={<SuperAdminSettings />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Routes>
    </SuperAdminShell>
  );
}

function AuthedArea({ session }: { session: Session }) {
  const navigate = useNavigate();
  const { path } = useI18n();
  const key = storageKey(session!.user.id);
  const [selection, setSelection] = useState<ProjectSelection | null>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
  });

  function onOnboarded(orgId: string, orgName: string, projectId: string, projectName: string) {
    const next = { orgId, orgName, projectId, projectName };
    localStorage.setItem(key, JSON.stringify(next));
    setSelection(next);
  }

  function switchProject() {
    localStorage.removeItem(key);
    setSelection(null);
    navigate(path("/app"));
  }

  // A cached selection can go stale (the org/project got deleted, or membership was revoked) —
  // confirm it's still real in the background rather than leaving the user stuck looking at a
  // dashboard that 403s on every request. list_my_projects silently omits anything the caller no
  // longer belongs to, so an empty match means "this selection no longer exists for you".
  useEffect(() => {
    if (!selection) return;
    mcp<{ id: string }[]>("list_my_projects", { organization_id: selection.orgId })
      .then((projects) => {
        if (!projects.some((p) => p.id === selection.projectId)) {
          localStorage.removeItem(key);
          setSelection(null);
        }
      })
      .catch(() => {});
  }, [selection?.orgId, selection?.projectId, key]);

  if (!selection) return <NoSelectionYet onOnboarded={onOnboarded} />;

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

/** A platform admin has their own dedicated area and no org of their own by design (see
 * docs/access-and-accounts.md) — send them to /superadmin instead of forcing them through
 * "create your own organization" onboarding just because they landed on /app with nothing
 * selected yet. Everyone else gets the normal onboarding flow. */
function NoSelectionYet({ onOnboarded }: { onOnboarded: (orgId: string, orgName: string, projectId: string, projectName: string) => void }) {
  const { path } = useI18n();
  const isAdmin = usePlatformAdmin();
  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center font-body-md text-on-surface-variant">Loading…</div>;
  if (isAdmin) return <Navigate to={path("/superadmin")} replace />;
  return <Onboarding onDone={onOnboarded} />;
}
