import { useEffect, useRef, useState } from "react";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";

type Org = { id: string; name: string; role: string };
type Project = { id: string; organization_id: string; name: string; role: string };

export default function Onboarding({ onDone }: { onDone: (orgId: string, orgName: string, projectId: string, projectName: string) => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2>(1);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // `busy` (state) only re-renders/disables the button on the NEXT tick — a fast double-click or an
  // Enter keypress landing in the same tick as a click can both slip through before that happens
  // and create two organizations/projects. This ref is set synchronously, so the second call bails
  // immediately regardless of when React re-renders.
  const submitting = useRef(false);

  useEffect(() => {
    mcp<Org[]>("list_my_organizations").then(setOrgs).catch((e) => setErr((e as Error).message));
  }, []);

  useEffect(() => {
    if (!orgId) return;
    mcp<Project[]>("list_my_projects", { organization_id: orgId }).then(setProjects).catch((e) => setErr((e as Error).message));
  }, [orgId]);

  async function continueToProject(id: string, name: string) {
    setOrgId(id);
    setOrgName(name);
    setStep(2);
  }

  async function createOrgAndContinue() {
    if (submitting.current) return;
    if (!newOrgName.trim()) { setErr("Organization name is required."); return; }
    submitting.current = true;
    setErr(null);
    setBusy(true);
    try {
      const org = await mcp<{ id: string; name: string }>("create_organization", { name: newOrgName.trim() });
      await continueToProject(org.id, org.name);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); submitting.current = false; }
  }

  async function createProjectAndFinish() {
    if (submitting.current) return;
    if (!newProjectName.trim()) { setErr("Project name is required."); return; }
    submitting.current = true;
    setErr(null);
    setBusy(true);
    try {
      const project = await mcp<{ id: string; name: string }>("create_project", { organization_id: orgId, name: newProjectName.trim() });
      onDone(orgId, orgName, project.id, project.name);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); submitting.current = false; }
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-surface relative overflow-hidden text-on-surface font-body-md text-body-md">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px", opacity: 0.03, color: "#191c1e" }}
      />
      <div className="flex-1 flex flex-col items-center justify-center p-gutter relative z-10">
        <div className="w-full max-w-md flex flex-col relative">
          <div className="border-b border-on-surface/10 pb-4 mb-8 flex justify-between items-end">
            <div>
              <div className="font-label-caps text-label-caps text-on-surface-variant tracking-[0.08em] uppercase mb-1">{t("onboarding.eyebrow")}</div>
              <div className="font-headline-md text-headline-md font-semibold tracking-[-0.01em]">{t("onboarding.title")}</div>
            </div>
            <div className="font-mono-data text-mono-data text-on-surface-variant flex items-center gap-2">
              <span>{step === 1 ? "01/02" : "02/02"}</span>
              <span className="w-2 h-2 rounded-full bg-primary" />
            </div>
          </div>

          {err && <p className="text-error font-body-md text-body-md mb-4">{err}</p>}

          {step === 1 && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h2 className="font-headline-sm text-headline-sm font-semibold">{t("onboarding.org.title")}</h2>
                <p className="text-on-surface-variant max-w-sm">{t("onboarding.org.body")}</p>
              </div>

              {orgs.length > 0 && (
                <div className="flex flex-col gap-3">
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => continueToProject(o.id, o.name)}
                      className="text-left px-6 py-3 border border-outline-variant rounded bg-surface-container-lowest hover:border-primary transition-colors flex items-center justify-between"
                    >
                      <span className="font-body-md text-on-surface font-medium">{o.name}</span>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-6">
                <div className="relative flex flex-col gap-2">
                  <label className="font-label-caps text-label-caps uppercase tracking-[0.08em] text-on-surface-variant">{t("onboarding.org.label")}</label>
                  <input
                    autoComplete="off"
                    className="w-full bg-surface-container-lowest border border-on-surface/20 rounded px-6 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="e.g. Acme Corp" type="text" value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createOrgAndContinue(); }}
                  />
                </div>
                <button
                  disabled={busy}
                  onClick={createOrgAndContinue}
                  className="w-full bg-primary text-on-primary font-label-caps text-label-caps uppercase tracking-[0.08em] rounded py-4 px-6 flex items-center justify-center gap-2 hover:bg-on-primary-container transition-colors disabled:opacity-60"
                >
                  {t("action.continue")}
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h2 className="font-headline-sm text-headline-sm font-semibold">{t("onboarding.project.title")}</h2>
                <p className="text-on-surface-variant max-w-sm">{t("onboarding.project.body")}</p>
              </div>

              {projects.length > 0 && (
                <div className="flex flex-col gap-3">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onDone(orgId, orgName, p.id, p.name)}
                      className="text-left px-6 py-3 border border-outline-variant rounded bg-surface-container-lowest hover:border-primary transition-colors flex items-center justify-between"
                    >
                      <span className="font-body-md text-on-surface font-medium">{p.name}</span>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-6">
                <div className="relative flex flex-col gap-2">
                  <label className="font-label-caps text-label-caps uppercase tracking-[0.08em] text-on-surface-variant">{t("onboarding.project.label")}</label>
                  <input
                    autoComplete="off"
                    className="w-full bg-surface-container-lowest border border-on-surface/20 rounded px-6 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="e.g. Production Data Core" type="text" value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createProjectAndFinish(); }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep(1)} className="w-12 h-12 shrink-0 bg-transparent border border-primary text-primary rounded flex items-center justify-center hover:bg-primary/5 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  </button>
                  <button
                    disabled={busy}
                    onClick={createProjectAndFinish}
                    className="flex-1 bg-primary text-on-primary font-label-caps text-label-caps uppercase tracking-[0.08em] rounded py-4 px-6 flex items-center justify-center gap-2 hover:bg-on-primary-container transition-colors disabled:opacity-60"
                  >
                    {t("onboarding.project.create")}
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
