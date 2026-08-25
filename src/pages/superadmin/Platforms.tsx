import { useEffect, useState } from "react";
import { mcp } from "../../lib/mcp";
import { useI18n } from "../../lib/i18n";

type Tool = {
  name: string; domain: string; risk: "low" | "medium" | "high"; description: string | null;
  supported_platforms: string[]; default_policy: "allow" | "deny" | "require_approval"; enabled: boolean;
};

const RISK_TONE: Record<string, string> = { low: "bg-secondary-container text-on-secondary-container", medium: "bg-tertiary-container text-on-tertiary-container", high: "bg-error-container text-on-error-container" };

export default function SuperAdminPlatforms() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Tool[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  function reload() {
    return mcp<Tool[]>("admin_list_platforms", {}).then(setRows).catch((e) => setErr((e as Error).message));
  }
  useEffect(() => { reload(); }, []);

  async function toggleEnabled(tool: Tool) {
    setBusyName(tool.name);
    setErr(null);
    try { await mcp("admin_upsert_platform_tool", { name: tool.name, domain: tool.domain, enabled: !tool.enabled }); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusyName(null); }
  }

  async function changePolicy(tool: Tool, policy: string) {
    setBusyName(tool.name);
    setErr(null);
    try { await mcp("admin_upsert_platform_tool", { name: tool.name, domain: tool.domain, default_policy: policy }); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusyName(null); }
  }

  return (
    <div className="flex flex-col w-full p-margin-page gap-margin-page max-w-7xl mx-auto">
      <div className="flex flex-col gap-unit">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("superadmin.platforms.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("superadmin.platforms.subtitle")}</p>
      </div>

      {err && <p className="text-error font-body-md text-body-md">{err}</p>}

      <div className="bg-surface-container-lowest flex flex-col rounded border border-outline-variant">
        {rows.length === 0 && <div className="px-gutter py-6 text-on-surface-variant font-body-md text-body-md">{t("superadmin.platforms.empty")}</div>}
        {rows.map((tool) => (
          <div key={tool.name} className="flex flex-col gap-3 px-gutter py-4 border-b border-outline-variant last:border-b-0 hover:bg-surface-container transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono-data text-mono-data text-primary">{tool.name}</span>
                  <span className={`font-label-caps text-label-caps px-2 py-0.5 rounded-full uppercase ${RISK_TONE[tool.risk]}`}>{tool.risk}</span>
                  {!tool.enabled && (
                    <span className="font-label-caps text-label-caps text-on-error-container bg-error-container px-2 py-0.5 rounded-full whitespace-nowrap">{t("superadmin.platforms.disabled")}</span>
                  )}
                </div>
                {tool.description && <p className="font-body-md text-body-md text-on-surface-variant mt-1">{tool.description}</p>}
                <p className="font-mono-data text-[12px] text-on-surface-variant mt-1">{t("superadmin.platforms.supportedPlatforms")}: {tool.supported_platforms.join(", ") || "—"}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <select
                  value={tool.default_policy}
                  disabled={busyName === tool.name}
                  onChange={(e) => changePolicy(tool, e.target.value)}
                  className="px-2 py-1 border border-outline-variant rounded font-label-caps text-label-caps uppercase bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary disabled:opacity-60"
                >
                  <option value="allow">allow</option>
                  <option value="deny">deny</option>
                  <option value="require_approval">require_approval</option>
                </select>
                <button
                  disabled={busyName === tool.name}
                  onClick={() => toggleEnabled(tool)}
                  className={"px-3 py-1.5 font-label-caps text-label-caps rounded border transition-colors disabled:opacity-60 " + (tool.enabled ? "border-error/50 text-error hover:bg-error/5" : "border-secondary/50 text-secondary hover:bg-secondary/5")}
                >
                  {tool.enabled ? t("superadmin.platforms.disableAction") : t("superadmin.platforms.enableAction")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
