import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { STATUS_LABEL_KEYS, useI18n } from "../lib/i18n";

type Ctx = { projectId: string };
type Integration = { id: string; platform: string; name: string; status: string };
type Agent = { id: string; name: string; status: string };
type Approval = { id: string; tool_name: string; integration_id: string; input: Record<string, unknown>; created_at: string };
type AuditLog = { id: string; tool_name: string; status: string; error_message: string | null; created_at: string };

const STATUS_DOT: Record<string, string> = { allowed: "bg-secondary", executed: "bg-secondary", require_approval: "bg-on-tertiary-container", denied: "bg-error", error: "bg-error" };

export default function Dashboard() {
  const { projectId } = useOutletContext<Ctx>();
  const { t } = useI18n();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      mcp<Integration[]>("list_integrations", {}, { projectId }),
      mcp<Agent[]>("list_agents", {}, { projectId }),
      mcp<Approval[]>("list_approvals", { status: "pending" }, { projectId }),
      mcp<AuditLog[]>("list_audit_logs", { limit: 5 }, { projectId }),
    ]).then(([i, a, ap, l]) => { setIntegrations(i); setAgents(a); setApprovals(ap); setLogs(l); })
      .catch((e) => setErr((e as Error).message));
  }, [projectId]);

  async function decide(id: string, decision: "approve" | "deny") {
    try {
      await mcp("resolve_approval", { approval_id: id, decision }, { projectId });
      setApprovals((rows) => rows.filter((r) => r.id !== id));
    } catch (e) { setErr((e as Error).message); }
  }

  const errorsToday = logs.filter((l) => l.status === "error").length;

  return (
    <div className="flex flex-col w-full p-margin-page gap-margin-page max-w-7xl mx-auto">
      <div className="flex flex-col gap-unit">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("dashboard.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("dashboard.subtitle")}</p>
      </div>

      {err && <p className="text-error font-body-md text-body-md">{err}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <StatCard label={t("nav.integrations")} icon="hub" value={integrations.length} suffix={t("dashboard.stat.integrations")} />
        <StatCard label={t("nav.agents")} icon="smart_toy" value={agents.length} suffix={t("dashboard.stat.agents")} />
        <StatCard label={t("nav.approvals")} icon="fact_check" value={approvals.length} suffix={t("dashboard.stat.approvals")} tone="warn" />
        <StatCard label={t("dashboard.stat.errorsTitle")} icon="check_circle" value={errorsToday} suffix={t("dashboard.stat.errors")} tone={errorsToday > 0 ? "danger" : "ok"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-8 flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant shadow-soft">
          <div className="px-gutter py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("dashboard.recentActivity")}</h2>
          </div>
          <div className="flex flex-col w-full">
            <div className="grid grid-cols-12 gap-4 px-gutter py-2 border-b border-outline-variant bg-surface-container-low">
              <div className="col-span-4 font-label-caps text-label-caps text-on-surface-variant uppercase">{t("table.timestamp")}</div>
              <div className="col-span-5 font-label-caps text-label-caps text-on-surface-variant uppercase">{t("table.tool")}</div>
              <div className="col-span-3 font-label-caps text-label-caps text-on-surface-variant uppercase">{t("table.status")}</div>
            </div>
            {logs.length === 0 && <div className="px-gutter py-6 text-on-surface-variant font-body-md text-body-md">{t("audit.empty")}</div>}
            {logs.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-4 px-gutter py-3 items-center border-b border-outline-variant bg-surface last:border-b-0">
                <div className="col-span-4 font-mono-data text-mono-data text-on-surface-variant">{new Date(r.created_at).toLocaleString()}</div>
                <div className="col-span-5 font-mono-data text-[12px] text-on-surface">{r.tool_name}</div>
                <div className="col-span-3 flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.status] ?? "bg-outline"}`} />
                  <span className="font-body-md text-[13px] text-on-surface-variant">{t(STATUS_LABEL_KEYS[r.status] ?? r.status)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-component-gap">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("dashboard.actionRequired")}</h2>
            {approvals.length > 0 && (
              <div className="bg-tertiary text-on-tertiary font-label-caps text-[10px] px-2 py-0.5 rounded-full">{approvals.length} PENDING</div>
            )}
          </div>
          {approvals.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">{t("dashboard.nothingPending")}</p>}
          {approvals.map((a) => (
            <div key={a.id} className="bg-surface-container-lowest rounded-xl p-gutter flex flex-col gap-4 border border-outline-variant shadow-soft hover:shadow-card transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <span className="font-label-caps text-label-caps text-primary uppercase">{a.tool_name}</span>
                </div>
                <span className="font-mono-data text-mono-data text-on-surface-variant text-[11px]">{new Date(a.created_at).toLocaleTimeString()}</span>
              </div>
              <pre className="font-mono-data text-[11px] text-on-surface-variant bg-surface-container-lowest p-3 rounded border border-outline-variant/50 overflow-x-auto">{JSON.stringify(a.input, null, 2)}</pre>
              <div className="flex gap-3 pt-2 border-t border-outline-variant">
                <button onClick={() => decide(a.id, "approve")} className="flex-1 bg-primary text-on-primary font-body-md text-[14px] font-medium py-2 px-4 rounded hover:bg-on-primary-container transition-colors flex justify-center items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check</span> {t("action.approve")}
                </button>
                <button onClick={() => decide(a.id, "deny")} className="flex-1 bg-transparent border border-outline text-on-surface font-body-md text-[14px] font-medium py-2 px-4 rounded hover:bg-surface-container-high transition-colors flex justify-center items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">close</span> {t("action.deny")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, icon, value, suffix, tone = "neutral" }: { label: string; icon: string; value: number; suffix: string; tone?: "neutral" | "warn" | "ok" | "danger" }) {
  const toneClasses = {
    neutral: "bg-surface-container-lowest text-on-surface-variant border border-outline-variant",
    warn: "bg-tertiary-container text-on-tertiary-container border border-tertiary/20",
    ok: "bg-secondary-container text-on-secondary-container border border-secondary/20",
    danger: "bg-error-container text-on-error-container border border-error/20",
  }[tone];
  const numberColor = tone === "warn" ? "text-on-tertiary-container" : tone === "ok" ? "text-on-secondary-container" : tone === "danger" ? "text-on-error-container" : "text-on-surface";
  return (
    <div className={`flex flex-col rounded-xl p-gutter relative overflow-hidden shadow-soft hover:shadow-card transition-shadow ${toneClasses}`}>
      <div className="flex justify-between items-start mb-4">
        <span className="font-label-caps text-label-caps uppercase tracking-wider">{label}</span>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="flex items-end gap-3">
        <span className={`font-mono-data text-[32px] font-bold leading-none ${numberColor}`}>{value}</span>
        <span className="font-body-md text-body-md pb-1 opacity-80">{suffix}</span>
      </div>
    </div>
  );
}
