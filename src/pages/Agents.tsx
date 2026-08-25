import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";

type Ctx = { projectId: string };
type Agent = { id: string; name: string; description: string | null; status: string };
type Permission = { id: string; tool_name: string; integration_id: string | null; permission: string };

const TOOLS = ["orders.search", "orders.get", "orders.refund"];
const DEFAULTS: Record<string, string> = { "orders.search": "allow", "orders.get": "allow", "orders.refund": "require_approval" };

export default function Agents() {
  const { projectId } = useOutletContext<Ctx>();
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [perms, setPerms] = useState<Permission[]>([]);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try {
      const rows = await mcp<Agent[]>("list_agents", {}, { projectId });
      setAgents(rows);
      if (!selected && rows.length) setSelected(rows[0].id);
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  useEffect(() => {
    if (!selected) return;
    mcp<Permission[]>("list_agent_tool_permissions", { agent_id: selected }, { projectId }).then(setPerms).catch((e) => setErr((e as Error).message));
  }, [selected, projectId]);

  function permissionFor(tool: string): string {
    const specific = perms.find((p) => p.tool_name === tool && p.integration_id === null);
    return specific?.permission ?? DEFAULTS[tool] ?? "deny";
  }

  async function setPermission(tool: string, permission: string) {
    try {
      await mcp("set_agent_tool_permission", { agent_id: selected, tool_name: tool, permission }, { projectId });
      setPerms((await mcp<Permission[]>("list_agent_tool_permissions", { agent_id: selected }, { projectId })));
    } catch (e) { setErr((e as Error).message); }
  }

  async function createAgent() {
    if (!newName.trim()) { setErr(t("agents.nameRequired")); return; }
    setErr(null);
    try { await mcp("create_agent", { name: newName.trim() }, { projectId }); setNewName(""); reload(); } catch (e) { setErr((e as Error).message); }
  }

  const selectedAgent = agents.find((a) => a.id === selected);

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-56px)]">
      <div className="flex-1 flex overflow-hidden">
        <div className="w-full sm:w-80 border-r border-outline-variant bg-surface flex flex-col shrink-0">
          <div className="p-gutter border-b border-outline-variant flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface m-0">{t("agents.title")}</h2>
          </div>
          <div className="p-gutter border-b border-outline-variant flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createAgent(); }} placeholder={t("agents.namePlaceholder")} className="flex-1 px-3 py-1.5 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
            <button onClick={createAgent} className="flex items-center gap-unit px-3 py-1.5 bg-primary text-on-primary rounded text-label-caps font-label-caps hover:bg-on-primary-container transition-colors">
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
          {err && <p className="text-error font-body-md text-body-md px-gutter pt-2">{err}</p>}
          <div className="flex-1 overflow-y-auto p-unit space-y-unit">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={"w-full text-left p-component-gap rounded flex items-start gap-component-gap relative " + (a.id === selected ? "bg-surface-container-high border border-outline-variant" : "hover:bg-surface-container transition-colors")}
              >
                {a.id === selected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l" />}
                <div className={"w-8 h-8 rounded flex items-center justify-center shrink-0 " + (a.id === selected ? "bg-primary-container text-on-primary-container" : "bg-surface-container-highest text-on-surface-variant")}>
                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-body-md text-body-md text-on-surface truncate block">{a.name}</span>
                  <div className="flex items-center gap-1 border border-secondary/30 bg-surface-container-lowest px-2 py-0.5 rounded-full w-fit mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">{t("status.active")}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
          <div className="p-margin-page flex-1 overflow-y-auto z-10 relative">
            {!selectedAgent && <p className="font-body-md text-body-md text-on-surface-variant">{t("agents.selectPrompt")}</p>}
            {selectedAgent && (
              <div className="max-w-4xl mx-auto">
                <header className="mb-gutter flex items-center gap-component-gap">
                  <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">smart_toy</span>
                  </div>
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface m-0">{selectedAgent.name}</h1>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1">Configure action permissions and tool access.</p>
                  </div>
                </header>

                <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                  <div className="p-gutter border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface m-0 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-primary">gavel</span>
                      {t("agents.policyMatrix")}
                    </h3>
                    <div className="flex items-center gap-4">
                      <Legend color="bg-secondary" label={t("status.allow")} />
                      <Legend color="bg-on-tertiary-container" label={t("status.requireApproval")} />
                      <Legend color="bg-error" label={t("status.deny")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-gutter px-gutter py-3 bg-surface border-b border-outline-variant">
                    <div className="col-span-5 font-label-caps text-label-caps text-on-surface-variant">Tool Namespace</div>
                    <div className="col-span-7 font-label-caps text-label-caps text-on-surface-variant">Access Level</div>
                  </div>
                  {TOOLS.map((tool) => {
                    const current = permissionFor(tool);
                    const isHighRisk = tool === "orders.refund";
                    return (
                      <div key={tool} className={"grid grid-cols-12 gap-gutter px-gutter items-center border-b border-outline-variant/50 last:border-b-0 " + (isHighRisk ? "py-4 items-start bg-on-tertiary-container/5" : "h-[56px]")}>
                        <div className="col-span-5 flex flex-col gap-2 pt-1.5">
                          <div className="flex items-center gap-component-gap">
                            <span className={"font-mono-data text-mono-data px-2 py-1 rounded " + (isHighRisk ? "text-on-tertiary-container bg-surface-container border border-on-tertiary-container/20" : "text-on-surface bg-surface-container")}>{tool}</span>
                            {isHighRisk && <span className="material-symbols-outlined text-on-tertiary-container text-[16px]">warning</span>}
                          </div>
                          {isHighRisk && (
                            <div className="mt-1 p-3 bg-surface-container-lowest border border-on-tertiary-container/30 rounded flex gap-2 max-w-xs">
                              <span className="material-symbols-outlined text-on-tertiary-container text-[18px] shrink-0 mt-0.5">info</span>
                              <p className="font-body-md text-[13px] leading-tight text-on-surface-variant m-0">{t("agents.highRisk")}</p>
                            </div>
                          )}
                        </div>
                        <div className="col-span-7 pt-1.5 flex items-start">
                          <div className="flex border border-outline-variant rounded p-1 bg-surface-container-low gap-1 w-full max-w-sm">
                            {(["allow", "require_approval", "deny"] as const).map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setPermission(tool, opt)}
                                className={
                                  "flex-1 py-1.5 rounded font-label-caps text-[10px] uppercase flex items-center justify-center gap-1 transition-all " +
                                  (current === opt
                                    ? opt === "deny"
                                      ? "bg-surface-container-lowest border border-error text-error shadow-sm"
                                      : opt === "require_approval"
                                      ? "bg-surface-container-lowest border border-on-tertiary-container text-on-tertiary-fixed-variant shadow-sm font-bold"
                                      : "bg-surface-container-lowest border border-secondary text-secondary shadow-sm"
                                    : "text-on-surface-variant hover:bg-surface-container opacity-60 hover:opacity-100")
                                }
                              >
                                {opt === "allow" ? t("status.allow") : opt === "require_approval" ? t("status.requireApproval") : t("status.deny")}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="font-label-caps text-label-caps text-on-surface-variant">{label}</span>
    </div>
  );
}
