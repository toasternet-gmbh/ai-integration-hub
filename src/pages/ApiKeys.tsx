import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";

type Ctx = { projectId: string };
type ApiKey = { id: string; name: string; key_suffix: string; last_used_at: string | null; created_at: string };

export default function ApiKeys() {
  const { projectId } = useOutletContext<Ctx>();
  const { t } = useI18n();
  const [rows, setRows] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try { setRows(await mcp<ApiKey[]>("list_api_keys", {}, { projectId })); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  async function create() {
    if (!name.trim()) { setErr(t("apiKeys.nameRequired")); return; }
    setErr(null);
    try {
      const created = await mcp<{ key: string }>("create_api_key", { name: name.trim() }, { projectId });
      setNewKey(created.key);
      setName("");
      reload();
    } catch (e) { setErr((e as Error).message); }
  }

  async function revoke(id: string) {
    try { await mcp("revoke_api_key", { id }, { projectId }); reload(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col w-full h-full relative font-body-md text-on-surface">
      <div className="px-margin-page py-gutter flex flex-col gap-margin-page max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t("apiKeys.title")}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-unit">{t("apiKeys.subtitle")}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} placeholder={t("apiKeys.namePlaceholder")} className="px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
            <button onClick={create} className="shrink-0 whitespace-nowrap bg-primary text-on-primary px-gutter py-2 rounded flex items-center justify-center gap-component-gap font-body-md hover:bg-on-primary-container transition-colors">
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t("apiKeys.create")}
            </button>
          </div>
        </div>

        {err && <p className="text-error font-body-md text-body-md">{err}</p>}

        <div className="bg-surface-container-lowest flex flex-col rounded border border-outline-variant">
          {rows.length === 0 && <div className="px-gutter py-6 text-on-surface-variant font-body-md text-body-md">{t("apiKeys.empty")}</div>}
          {rows.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-4 px-gutter py-4 border-b border-outline-variant last:border-b-0 hover:bg-surface-container transition-colors">
              <div className="flex items-center gap-component-gap min-w-0">
                <div className="w-8 h-8 shrink-0 rounded bg-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px] text-on-secondary-container">vpn_key</span>
                </div>
                <div className="min-w-0">
                  <div className="font-body-md text-body-md font-bold text-on-surface truncate">{k.name}</div>
                  <div className="font-mono-data text-[12px] text-on-surface-variant flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span>hub_••••{k.key_suffix}</span>
                    <span className="hidden sm:inline">· {t("apiKeys.col.created")} {new Date(k.created_at).toLocaleDateString()}</span>
                    <span className="hidden sm:inline-flex items-center gap-1">
                      · <span className={"w-1.5 h-1.5 rounded-full " + (k.last_used_at ? "bg-secondary" : "bg-outline")} />
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => revoke(k.id)} className="shrink-0 text-on-surface-variant hover:text-error transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-surface bg-transparent border-none">
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-gutter">
          <div className="flex-1 bg-surface-container-lowest rounded p-gutter border border-outline-variant flex flex-col gap-gutter">
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-unit">
              <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
              {t("apiKeys.quickStart")}
            </h2>
            <div className="bg-inverse-surface rounded overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 bg-on-surface border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-error/80" /><span className="w-2.5 h-2.5 rounded-full bg-on-tertiary-container/80" /><span className="w-2.5 h-2.5 rounded-full bg-secondary/80" />
                </div>
                <span className="font-mono-data text-[11px] text-inverse-on-surface/50">app.js</span>
              </div>
              <pre className="p-4 font-mono-data text-mono-data text-inverse-on-surface overflow-x-auto">{`import { HubClient } from '@ai-integration/hub';

const client = new HubClient({
  baseUrl: process.env.HUB_BASE_URL,
  apiKey: process.env.HUB_API_KEY,
  agentId: 'my-agent'
});

const orders = await client.tools.orders.search({
  integration_id: 'int_...',
  status: 'pending_approval',
  limit: 10
});`}</pre>
            </div>
          </div>
        </div>
      </div>

      {newKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg border border-outline-variant shadow-xl">
            <div className="px-gutter py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-headline-md text-headline-md text-on-surface">{t("apiKeys.created")}</h3>
            </div>
            <div className="p-gutter flex flex-col gap-gutter">
              <div className="bg-error-container/20 border border-error-container p-4 rounded flex gap-3">
                <span className="material-symbols-outlined text-error text-[20px] mt-0.5">warning</span>
                <div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface mb-1">{t("apiKeys.saveNow")}</h4>
                  <p className="font-body-md text-body-md text-on-surface-variant">{t("apiKeys.saveWarning")}</p>
                </div>
              </div>
              <div className="flex flex-col gap-unit">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Secret Key</label>
                <div className="flex">
                  <input readOnly value={newKey} className="flex-1 bg-surface-container px-3 py-2 font-mono-data text-mono-data text-on-surface border border-outline-variant border-r-0 focus:outline-none" />
                  <button
                    onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="bg-primary text-on-primary px-4 py-2 border border-primary hover:bg-on-primary-container transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">{copied ? "check" : "content_copy"}</span>
                    <span className="font-body-md font-bold">{t("apiKeys.copy")}</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="px-gutter py-4 border-t border-outline-variant bg-surface-container-low flex justify-end">
              <button onClick={() => setNewKey(null)} className="px-gutter py-2 text-primary font-body-md hover:bg-primary/5 transition-colors bg-transparent border-none">{t("apiKeys.done")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
