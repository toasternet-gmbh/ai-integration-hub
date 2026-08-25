import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { STATUS_LABEL_KEYS, useI18n } from "../lib/i18n";

type Ctx = { projectId: string };
type AuditLog = { id: string; tool_name: string; integration_id: string | null; status: string; error_message: string | null; created_at: string };

const STATUS_STYLE: Record<string, string> = {
  allowed: "bg-secondary-container/20 border-secondary/20 text-secondary",
  executed: "bg-secondary-container/20 border-secondary/20 text-secondary",
  error: "bg-error-container/20 border-error/20 text-error",
  denied: "bg-error-container/20 border-error/20 text-error",
  require_approval: "bg-tertiary-container/20 border-tertiary/20 text-tertiary",
};

export default function Audit() {
  const { projectId } = useOutletContext<Ctx>();
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    mcp<AuditLog[]>("list_audit_logs", { limit: 200 }, { projectId }).then(setRows).catch((e) => setErr((e as Error).message));
  }, [projectId]);

  const filtered = rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search && !r.tool_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function exportCsv() {
    const header = "timestamp,tool,status,detail\n";
    const body = filtered.map((r) => [new Date(r.created_at).toISOString(), r.tool_name, r.status, (r.error_message ?? "").replace(/,/g, ";")].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit-logs.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col w-full h-full bg-surface text-on-surface">
      <div className="px-gutter py-margin-page flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("audit.title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-unit">{t("audit.subtitle")}</p>
        </div>
        <button onClick={exportCsv} className="h-row-height-density px-gutter rounded bg-primary-container text-on-primary-container flex items-center gap-unit hover:bg-primary hover:text-on-primary transition-colors">
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span className="font-label-caps text-label-caps tracking-widest">{t("audit.export")}</span>
        </button>
      </div>

      {err && <p className="text-error font-body-md text-body-md px-gutter">{err}</p>}

      <div className="px-gutter pb-gutter flex flex-col lg:flex-row gap-gutter">
        <div className="flex-1 min-w-[300px]">
          <label className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-unit block">{t("audit.search")}</label>
          <div className="relative h-row-height-density flex items-center bg-surface-container rounded border border-outline-variant/20 focus-within:border-primary-container transition-colors">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant ml-3">search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 h-full bg-transparent border-none outline-none px-3 font-body-md text-body-md text-on-surface" placeholder={t("audit.searchPlaceholder")} />
          </div>
        </div>
        <div className="w-full lg:w-auto">
          <label className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-unit block">{t("audit.statusFilter")}</label>
          <div className="flex items-center gap-unit flex-wrap">
            {[
              { key: "allowed", label: t("status.success"), color: "bg-secondary" },
              { key: "error", label: t("status.error"), color: "bg-error" },
              { key: "require_approval", label: t("status.pending"), color: "bg-tertiary" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter((f) => (f === s.key ? null : s.key))}
                className={"h-row-height-density px-4 rounded-full font-label-caps text-label-caps border flex items-center gap-2 transition-colors " + (statusFilter === s.key ? `${s.color} text-white border-transparent` : "bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-outline")}
              >
                <span className={`w-[6px] h-[6px] rounded-full ${s.color}`} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-gutter flex-1 pb-margin-page">
        <div className="w-full overflow-x-auto bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-sm">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low">
                <th className="py-3 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest whitespace-nowrap">{t("table.timestamp")}</th>
                <th className="py-3 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">{t("table.tool")}</th>
                <th className="py-3 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">{t("table.status")}</th>
                <th className="py-3 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">{t("table.detail")}</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface">
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="py-6 px-4 text-on-surface-variant">{t("audit.empty")}</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/20 hover:bg-surface-container/50 transition-colors">
                  <td className="py-3 px-4 font-mono-data text-mono-data text-on-surface-variant tabular-nums whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono-data text-mono-data text-primary">{r.tool_name}</td>
                  <td className="py-3 px-4">
                    <div className={"inline-flex items-center gap-2 h-6 px-2 rounded-full border " + (STATUS_STYLE[r.status] ?? "bg-surface-variant border-outline-variant/20 text-on-surface-variant")}>
                      <span className="w-[6px] h-[6px] rounded-full bg-current" />
                      <span className="font-label-caps text-label-caps uppercase">{t(STATUS_LABEL_KEYS[r.status] ?? r.status)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-on-surface-variant truncate max-w-[300px]" title={r.error_message ?? ""}>{r.error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
