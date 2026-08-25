import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { STATUS_LABEL_KEYS, useI18n } from "../lib/i18n";

type Ctx = { projectId: string };
type Approval = {
  id: string; agent_id: string; tool_name: string; integration_id: string; input: Record<string, unknown>;
  status: string; created_at: string; decided_at?: string; result?: unknown;
};

export default function Approvals() {
  const { projectId } = useOutletContext<Ctx>();
  const { t } = useI18n();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pending, setPending] = useState<Approval[]>([]);
  const [history, setHistory] = useState<Approval[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try {
      setPending(await mcp<Approval[]>("list_approvals", { status: "pending" }, { projectId }));
      const decided = await Promise.all([
        mcp<Approval[]>("list_approvals", { status: "executed" }, { projectId }).catch(() => []),
        mcp<Approval[]>("list_approvals", { status: "approved" }, { projectId }).catch(() => []),
        mcp<Approval[]>("list_approvals", { status: "denied" }, { projectId }).catch(() => []),
      ]);
      setHistory(decided.flat().sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at)));
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  async function decide(id: string, decision: "approve" | "deny") {
    setErr(null);
    try { await mcp("resolve_approval", { approval_id: id, decision }, { projectId }); reload(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col w-full relative pb-margin-page bg-background">
      <div className="px-gutter pt-gutter pb-4 flex flex-col md:flex-row md:items-end justify-between gap-gutter border-b border-outline-variant">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-background mb-2">{t("approvals.title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("approvals.subtitle")}</p>
        </div>
      </div>

      {err && <p className="text-error font-body-md text-body-md px-gutter pt-4">{err}</p>}

      <div className="flex-1 px-gutter py-gutter relative max-w-5xl">
        <div className="flex items-center gap-6 border-b border-outline-variant mb-6">
          <button onClick={() => setTab("pending")} className={"pb-3 border-b-2 font-headline-sm text-headline-sm flex items-center gap-2 transition-colors bg-transparent border-t-0 border-x-0 " + (tab === "pending" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface")}>
            {t("approvals.tab.pending")}
            {pending.length > 0 && <span className="bg-primary text-on-primary text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center h-[20px] min-w-[20px]">{pending.length}</span>}
          </button>
          <button onClick={() => setTab("history")} className={"pb-3 border-b-2 font-headline-sm text-headline-sm transition-colors bg-transparent border-t-0 border-x-0 " + (tab === "history" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface")}>
            {t("approvals.tab.history")}
          </button>
        </div>

        {tab === "pending" && (
          <div className="flex flex-col gap-6">
            {pending.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">{t("approvals.empty")}</p>}
            {pending.map((a) => (
              <div key={a.id} className="bg-surface-container-lowest border border-outline-variant rounded flex flex-col transition-all hover:border-outline">
                <div className="px-6 py-5 border-b border-outline-variant flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">support_agent</span>
                    </div>
                    <div className="flex flex-col gap-1 mt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-data text-mono-data text-primary px-1.5 py-0.5 bg-primary-fixed-dim/20 rounded">{a.tool_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-variant border border-outline-variant/30 h-[24px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container" />
                      <span className="font-label-caps text-label-caps text-on-surface uppercase">{t("approvals.awaitingDecision")}</span>
                    </div>
                    <span className="font-mono-data text-[12px] text-outline">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="px-6 py-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">{t("approvals.summary")}</span>
                    <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
                      {a.input.order_id ? t("approvals.refundOrder").replace("{id}", String(a.input.order_id)) : a.tool_name}
                    </p>
                  </div>
                  {typeof a.input.reason === "string" && (
                    <div className="flex flex-col gap-2 p-4 bg-surface-container rounded border border-outline-variant/50 border-l-4 border-l-tertiary-fixed-dim">
                      <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">{t("approvals.reason")}</span>
                      <p className="font-body-md text-body-md text-on-surface italic">"{a.input.reason}"</p>
                    </div>
                  )}
                  <div className="mt-2 border border-outline-variant rounded overflow-hidden">
                    <button onClick={() => setExpanded((e) => ({ ...e, [a.id]: !e[a.id] }))} className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-container transition-colors text-left bg-transparent border-none">
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px]">data_object</span>
                        <span className="font-label-caps text-label-caps uppercase">{t("approvals.showTech")}</span>
                      </div>
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{expanded[a.id] ? "expand_less" : "expand_more"}</span>
                    </button>
                    {expanded[a.id] && (
                      <div className="border-t border-outline-variant bg-surface-container-lowest p-4">
                        <pre className="font-mono-data text-mono-data text-on-surface-variant bg-on-surface p-4 rounded text-surface-container-lowest overflow-x-auto text-[12px] leading-relaxed">{JSON.stringify(a.input, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-outline-variant bg-surface flex flex-col sm:flex-row items-center gap-3">
                  <button onClick={() => decide(a.id, "approve")} className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded font-headline-sm text-[16px] hover:bg-on-primary-container transition-colors">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    <span>{t("approvals.approveRun")}</span>
                  </button>
                  <button onClick={() => decide(a.id, "deny")} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-transparent text-error border border-error/50 rounded font-headline-sm text-[16px] hover:bg-error/5 transition-colors">
                    <span className="material-symbols-outlined text-[20px]">block</span>
                    {t("action.deny")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-4">
            {history.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">{t("approvals.emptyHistory")}</p>}
            {history.map((a) => (
              <div key={a.id} className="bg-surface-container-lowest border border-outline-variant rounded flex flex-col opacity-90">
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className={"w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-outline-variant/30 " + (a.status === "approved" || a.status === "executed" ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container")}>
                    <span className="material-symbols-outlined text-[16px]">{a.status === "approved" || a.status === "executed" ? "check" : "close"}</span>
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <p className="font-body-md text-body-md text-on-surface">
                      <span className="font-mono-data text-mono-data bg-surface-container px-1 py-0.5 rounded mr-1">{a.tool_name}</span>
                      {t(STATUS_LABEL_KEYS[a.status] ?? a.status)}
                    </p>
                    <span className="font-body-md text-[13px] text-on-surface-variant">{new Date(a.decided_at ?? a.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
