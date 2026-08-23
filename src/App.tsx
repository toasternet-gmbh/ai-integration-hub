import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { mcp } from "./lib/mcp";

type Session = { user: { id: string; email?: string } } | null;
type Org = { id: string; name: string; role: string };
type Project = { id: string; organization_id: string; name: string; role: string };

export default function App() {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session as Session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s as Session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="container">Loading…</div>;
  if (!session) return <LoginPage />;
  return <ProjectShell />;
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await fn({ email, password });
    if (error) setErr(error.message);
  }

  return (
    <div className="container" style={{ maxWidth: 360, marginTop: 80 }}>
      <h1>AI Integration Hub</h1>
      <form className="card" onSubmit={submit}>
        <div style={{ marginBottom: 8 }}><input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} /></div>
        <div style={{ marginBottom: 8 }}><input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} /></div>
        {err && <p className="error">{err}</p>}
        <button type="submit" className="primary">{mode === "signin" ? "Sign in" : "Sign up"}</button>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} style={{ marginLeft: 8 }}>
          {mode === "signin" ? "Need an account?" : "Have an account?"}
        </button>
      </form>
    </div>
  );
}

/** Picks (or bootstraps) an organization + project, then renders the project dashboard. */
function ProjectShell() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  async function reloadOrgs() {
    try { setOrgs(await mcp<Org[]>("list_my_organizations")); } catch (e) { setErr((e as Error).message); }
  }
  async function reloadProjects(forOrgId: string) {
    try { setProjects(await mcp<Project[]>("list_my_projects", { organization_id: forOrgId })); } catch (e) { setErr((e as Error).message); }
  }

  useEffect(() => { reloadOrgs(); }, []);
  useEffect(() => { if (orgId) reloadProjects(orgId); }, [orgId]);

  if (projectId) return <ProjectDashboard projectId={projectId} onLeave={() => setProjectId("")} />;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>AI Integration Hub</h1>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      {err && <p className="error">{err}</p>}

      <div className="card">
        <h2>1. Organization</h2>
        <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} onCreated={reloadOrgs} />
      </div>

      {orgId && (
        <div className="card">
          <h2>2. Project</h2>
          <ProjectPicker projects={projects} orgId={orgId} onPick={setProjectId} onCreated={() => reloadProjects(orgId)} />
        </div>
      )}
    </div>
  );
}

function OrgPicker({ orgs, value, onChange, onCreated }: { orgs: Org[]; value: string; onChange: (v: string) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  async function create() {
    if (!name.trim()) return;
    await mcp("create_organization", { name });
    setName("");
    onCreated();
  }
  return (
    <>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <input placeholder="New organization name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={create}>Create</button>
    </>
  );
}

function ProjectPicker({ projects, orgId, onPick, onCreated }: { projects: Project[]; orgId: string; onPick: (v: string) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  async function create() {
    if (!name.trim()) return;
    await mcp("create_project", { organization_id: orgId, name });
    setName("");
    onCreated();
  }
  return (
    <>
      <table>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td><button onClick={() => onPick(p.id)}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <input placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={create}>Create</button>
    </>
  );
}

type Integration = { id: string; platform: string; name: string; status: string; error_status: string | null };
type Agent = { id: string; name: string; description: string | null; status: string };
type Approval = { id: string; agent_id: string; tool_name: string; integration_id: string; input: Record<string, unknown>; status: string; created_at: string };
type AuditLog = { id: string; tool_name: string; status: string; error_message: string | null; created_at: string };

function ProjectDashboard({ projectId, onLeave }: { projectId: string; onLeave: () => void }) {
  const [tab, setTab] = useState<"integrations" | "agents" | "approvals" | "audit">("integrations");
  const [pending, setPending] = useState(0);

  async function refreshPending() {
    try { setPending((await mcp<{ pending: number }>("count_pending_approvals", {}, { projectId })).pending); } catch { /* ignore */ }
  }
  useEffect(() => {
    refreshPending();
    const t = setInterval(refreshPending, 15000);
    return () => clearInterval(t);
  }, [projectId]);

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>AI Integration Hub</h1>
        <div>
          <button onClick={onLeave}>Switch project</button>
          <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: 8 }}>Sign out</button>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === "integrations" ? "active" : ""} onClick={() => setTab("integrations")}>Integrations</button>
        <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>Agents</button>
        <button className={tab === "approvals" ? "active" : ""} onClick={() => setTab("approvals")}>
          Approvals {pending > 0 && <span className="badge badge-pending">{pending}</span>}
        </button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Audit Logs</button>
      </div>

      {tab === "integrations" && <IntegrationsTab projectId={projectId} />}
      {tab === "agents" && <AgentsTab projectId={projectId} />}
      {tab === "approvals" && <ApprovalsTab projectId={projectId} onChanged={refreshPending} />}
      {tab === "audit" && <AuditTab projectId={projectId} />}
    </div>
  );
}

function IntegrationsTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Integration[]>([]);
  const [platform, setPlatform] = useState("woocommerce");
  const [name, setName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try { setRows(await mcp<Integration[]>("list_integrations", {}, { projectId })); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  async function create() {
    setErr(null);
    try {
      const credentials = platform === "shopware"
        ? { storeUrl, clientId: consumerKey, clientSecret: consumerSecret }
        : { storeUrl, consumerKey, consumerSecret };
      await mcp("create_integration", { platform, name, credentials }, { projectId });
      setName(""); setStoreUrl(""); setConsumerKey(""); setConsumerSecret("");
      reload();
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="card">
      <h2>Integrations</h2>
      {err && <p className="error">{err}</p>}
      <table>
        <thead><tr><th>Name</th><th>Platform</th><th>Status</th><th>Id (for Agents tab)</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{r.platform}</td>
              <td><span className={`badge badge-${r.status}`}>{r.status}</span> {r.error_status && <small>{r.error_status}</small>}</td>
              <td><code>{r.id}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Connect a store</h3>
      <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="woocommerce">WooCommerce</option>
          <option value="shopware">Shopware 6</option>
        </select>
        <input placeholder="Integration name (e.g. Main Store)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Store URL (e.g. http://localhost:8090)" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} />
        <input placeholder={platform === "shopware" ? "Client ID" : "Consumer key"} value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} />
        <input placeholder={platform === "shopware" ? "Client secret" : "Consumer secret"} type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} />
        <div><button className="primary" onClick={create}>Connect &amp; test</button></div>
      </div>
    </div>
  );
}

function AgentsTab({ projectId }: { projectId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [toolName, setToolName] = useState("orders.get");
  const [integrationId, setIntegrationId] = useState("");
  const [permission, setPermission] = useState("allow");
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try { setAgents(await mcp<Agent[]>("list_agents", {}, { projectId })); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  async function create() {
    if (!name.trim()) return;
    await mcp("create_agent", { name }, { projectId });
    setName(""); reload();
  }
  async function setPerm() {
    setErr(null);
    try {
      await mcp("set_agent_tool_permission", { agent_id: selectedAgent, tool_name: toolName, integration_id: integrationId || undefined, permission }, { projectId });
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="card">
      <h2>Agents</h2>
      {err && <p className="error">{err}</p>}
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Id</th></tr></thead>
        <tbody>{agents.map((a) => <tr key={a.id}><td>{a.name}</td><td>{a.status}</td><td><code>{a.id}</code></td></tr>)}</tbody>
      </table>
      <div><input placeholder="New agent name" value={name} onChange={(e) => setName(e.target.value)} /><button onClick={create}>Create agent</button></div>

      <h3>Grant a tool permission</h3>
      <p style={{ fontSize: 13, color: "#666" }}>orders.refund defaults to require_approval and orders.get/orders.search default to allow (tool_registry) — you only need this to override, e.g. explicitly allow orders.get for one agent.</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
          <option value="">— agent —</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={toolName} onChange={(e) => setToolName(e.target.value)}>
          <option value="orders.search">orders.search</option>
          <option value="orders.get">orders.get</option>
          <option value="orders.refund">orders.refund</option>
        </select>
        <input placeholder="Integration id (optional = all)" value={integrationId} onChange={(e) => setIntegrationId(e.target.value)} />
        <select value={permission} onChange={(e) => setPermission(e.target.value)}>
          <option value="allow">allow</option>
          <option value="deny">deny</option>
          <option value="require_approval">require_approval</option>
        </select>
        <button onClick={setPerm}>Set</button>
      </div>
    </div>
  );
}

function ApprovalsTab({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [rows, setRows] = useState<Approval[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try { setRows(await mcp<Approval[]>("list_approvals", { status: "pending" }, { projectId })); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  async function decide(id: string, decision: "approve" | "deny") {
    setErr(null);
    try { await mcp("resolve_approval", { approval_id: id, decision }, { projectId }); reload(); onChanged(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="card">
      <h2>Pending approvals</h2>
      {err && <p className="error">{err}</p>}
      {rows.length === 0 && <p>Nothing pending.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card" style={{ background: "#fafafa" }}>
          <div><code>{r.tool_name}</code> — <small>{new Date(r.created_at).toLocaleString()}</small></div>
          <pre style={{ fontSize: 12, background: "#f0f0f0", padding: 8 }}>{JSON.stringify(r.input, null, 2)}</pre>
          <button className="primary" onClick={() => decide(r.id, "approve")}>Approve</button>
          <button className="danger" onClick={() => decide(r.id, "deny")} style={{ marginLeft: 8 }}>Deny</button>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    mcp<AuditLog[]>("list_audit_logs", { limit: 100 }, { projectId }).then(setRows).catch((e) => setErr((e as Error).message));
  }, [projectId]);

  return (
    <div className="card">
      <h2>Audit logs (last 100)</h2>
      {err && <p className="error">{err}</p>}
      <table>
        <thead><tr><th>When</th><th>Tool</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td><code>{r.tool_name}</code></td>
              <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
              <td>{r.error_message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
