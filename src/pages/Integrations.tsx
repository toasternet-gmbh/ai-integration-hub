import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";
import { CATEGORY_LABEL, PLATFORM_CATALOG, platformsByCategory } from "../lib/platformCatalog";

type Ctx = { projectId: string };
type Capability = { domain: string; tools: string[] };
type Integration = { id: string; platform: string; name: string; status: string; error_status: string | null; capabilities: Capability[] | null };
type Institution = { id: string; name: string };

const PLATFORM_ICON: Record<string, string> = Object.fromEntries(PLATFORM_CATALOG.map((p) => [p.id, p.icon]));

const TOKEN_AUTH_PLATFORMS = new Set(["shopify", "magento"]);
// Single-API-key platforms — no store URL, no separate key/secret pair.
const NO_STORE_URL_PLATFORMS = new Set(["lexoffice", "toggl"]);
// Consent-redirect platforms — no credentials form at all; the user picks their bank and is sent
// to GoCardless to authenticate, same auth_type='oauth2' distinction hub_platform_types makes.
const OAUTH2_PLATFORMS = new Set(["gocardless"]);

export default function Integrations() {
  const { projectId } = useOutletContext<Ctx>();
  const { t, path, lang } = useI18n();
  const [rows, setRows] = useState<Integration[]>([]);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("woocommerce");
  const [name, setName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [bankCountry, setBankCountry] = useState("de");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [institutionsBusy, setInstitutionsBusy] = useState(false);

  async function reload() {
    try { setRows(await mcp<Integration[]>("list_integrations", {}, { projectId })); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  async function searchInstitutions() {
    setInstitutionsBusy(true);
    setResult(null);
    try { setInstitutions(await mcp<Institution[]>("list_bank_institutions", { country: bankCountry })); }
    catch (e) { setResult({ ok: false, message: (e as Error).message }); }
    finally { setInstitutionsBusy(false); }
  }

  async function connectBank() {
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const redirectUrl = `${window.location.origin}${path("/app/integrations/bank-callback")}`;
      const { redirect_url } = await mcp<{ integration_id: string; redirect_url: string }>(
        "start_bank_connection",
        { institution_id: institutionId, name, redirect_url: redirectUrl },
        { projectId },
      );
      window.location.href = redirect_url;
    } catch (e) { setResult({ ok: false, message: (e as Error).message }); setBusy(false); }
  }

  async function connect() {
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const credentials =
        platform === "lexoffice" ? { apiKey: secret }
        : platform === "toggl" ? { apiToken: secret }
        : platform === "wordpress" ? { siteUrl: storeUrl, username: key, appPassword: secret }
        : platform === "shopware" ? { storeUrl, clientId: key, clientSecret: secret }
        : TOKEN_AUTH_PLATFORMS.has(platform) ? { storeUrl, accessToken: secret }
        : { storeUrl, consumerKey: key, consumerSecret: secret };
      await mcp("create_integration", { platform, name, credentials }, { projectId });
      // Re-fetch rather than trust a hardcoded capability list — hub_integrations.capabilities
      // is what create_integration actually populates, and it varies by platform/tool support.
      const updated = await mcp<Integration[]>("list_integrations", {}, { projectId });
      setRows(updated);
      const created = updated.find((r) => r.platform === platform && r.name === name);
      const toolNames = (created?.capabilities ?? []).flatMap((c) => c.tools);
      setResult({
        ok: true,
        message: toolNames.length
          ? `Connected — ${toolNames.length} ${toolNames.length === 1 ? "capability" : "capabilities"} discovered: ${toolNames.join(", ")}`
          : `Connected — no capabilities discovered yet for ${platform}. Check the integration's status once the next sync completes.`,
      });
      setName(""); setStoreUrl(""); setKey(""); setSecret("");
    } catch (e) { setResult({ ok: false, message: (e as Error).message }); } finally { setBusy(false); }
  }

  async function testConnection(id: string) {
    try { await mcp("test_integration_connection", { integration_id: id }, { projectId }); reload(); } catch (e) { setErr((e as Error).message); }
  }

  async function disconnect(id: string, name: string) {
    if (!window.confirm(t("integrations.disconnectConfirm").replace("{name}", name))) return;
    try { await mcp("delete_integration", { integration_id: id }, { projectId }); reload(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col w-full relative">
      <div className="px-margin-page py-margin-page flex flex-col sm:flex-row sm:items-center justify-between gap-gutter border-b border-outline-variant bg-surface-container-low/50">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("integrations.title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-unit">{t("integrations.subtitle")}</p>
        </div>
        <button onClick={() => setOpen(true)} className="self-start sm:self-auto shrink-0 bg-primary hover:bg-on-primary-container text-on-primary font-label-caps text-label-caps px-4 py-2 rounded flex items-center gap-2 transition-colors">
          <span className="material-symbols-outlined text-[16px]">add</span>
          {t("integrations.connectStore").toUpperCase()}
        </button>
      </div>

      <div className="p-margin-page grid grid-cols-12 gap-gutter">
        <div className={`col-span-12 ${open ? "lg:col-span-8" : ""} space-y-gutter`}>
          {err && <p className="text-error font-body-md text-body-md">{err}</p>}
          <div className="bg-surface border-t border-b border-outline-variant">
            <div className="px-gutter py-3 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-on-surface-variant">ACTIVE INTEGRATIONS</span>
              <span className="font-mono-data text-mono-data text-on-surface-variant">{rows.length} CONNECTED</span>
            </div>
            {rows.length === 0 && <div className="p-gutter text-on-surface-variant font-body-md text-body-md">{t("integrations.empty")}</div>}
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-gutter hover:bg-surface-container-lowest transition-colors border-b border-outline-variant last:border-b-0">
                <div className="flex items-center gap-gutter min-w-0">
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-surface-container border border-outline-variant rounded">
                    <span className="material-symbols-outlined text-on-surface-variant text-[24px]">{PLATFORM_ICON[r.platform] ?? "hub"}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{r.name}</h3>
                      <div className={"h-6 px-2 flex items-center gap-2 border rounded-full shrink-0 " + (r.status === "connected" ? "bg-surface-container border-secondary/30" : "bg-error-container border-error/30")}>
                        <span className={"w-1.5 h-1.5 rounded-full " + (r.status === "connected" ? "bg-secondary" : "bg-error")} />
                        <span className="font-label-caps text-label-caps text-on-surface whitespace-nowrap">{r.status === "connected" ? t("status.connected").toUpperCase() : r.status.toUpperCase()}</span>
                      </div>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1 flex items-center gap-2">
                      <span className="font-mono-data text-mono-data text-on-surface">{r.platform}</span>
                      {r.error_status && <><span>•</span><span className="text-error truncate">{r.error_status}</span></>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => testConnection(r.id)} className="px-4 py-2 border border-primary text-primary font-label-caps text-label-caps rounded hover:bg-primary/5 transition-colors whitespace-nowrap">
                    {t("action.testConnection").toUpperCase()}
                  </button>
                  <button onClick={() => disconnect(r.id, r.name)} className="w-9 h-9 shrink-0 flex items-center justify-center border border-outline-variant text-on-surface-variant hover:text-error hover:border-error rounded transition-colors bg-transparent">
                    <span className="material-symbols-outlined text-[18px]">link_off</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {open && (
          <div className="col-span-12 lg:col-span-4 pl-gutter border-l border-outline-variant flex flex-col h-full bg-surface-container-lowest fixed right-0 top-14 bottom-0 w-full lg:w-[400px] z-30">
            <div className="px-gutter py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest sticky top-0 z-10">
              <h2 className="font-headline-md text-headline-md text-on-surface">{t("integrations.connectStore")}</h2>
              <button onClick={() => { setOpen(false); setResult(null); }} className="text-on-surface-variant hover:text-on-surface bg-transparent border-none">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-gutter overflow-y-auto flex-1 bg-surface-container-lowest">
              <div className="mb-8">
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-3">{t("integrations.selectPlatform").toUpperCase()}</label>
                <div className="flex flex-col gap-5">
                  {platformsByCategory().map((group) => (
                    <div key={group.category}>
                      <span className="block font-label-caps text-label-caps text-on-surface-variant/70 mb-2 tracking-wide">{CATEGORY_LABEL[group.category][lang]}</span>
                      <div className="grid grid-cols-2 gap-3">
                        {group.platforms.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setPlatform(p.id)}
                            className={
                              "flex flex-col items-center justify-center p-4 rounded transition-colors " +
                              (platform === p.id ? "border-2 border-primary bg-primary/5" : "border border-outline-variant bg-surface hover:border-primary")
                            }
                          >
                            <span
                              className={"material-symbols-outlined text-[28px] mb-2 " + (platform === p.id ? "text-primary" : "")}
                              style={platform === p.id ? undefined : { color: p.color }}
                            >
                              {p.icon}
                            </span>
                            <span className={"font-body-md text-body-md font-semibold " + (platform === p.id ? "text-primary" : "text-on-surface")}>{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {(() => {
                  const selected = PLATFORM_CATALOG.find((p) => p.id === platform);
                  return selected ? <p className="font-body-md text-body-md text-on-surface-variant mt-4">{selected.description[lang]}</p> : null;
                })()}
              </div>
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("integrations.name").toUpperCase()}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" placeholder="Main Store" />
                </div>
                {!OAUTH2_PLATFORMS.has(platform) && !NO_STORE_URL_PLATFORMS.has(platform) && (
                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("integrations.storeUrl").toUpperCase()}</label>
                    <input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} className="w-full px-4 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" placeholder="https://your-store.com" type="url" />
                  </div>
                )}
                {!TOKEN_AUTH_PLATFORMS.has(platform) && !NO_STORE_URL_PLATFORMS.has(platform) && !OAUTH2_PLATFORMS.has(platform) && (
                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{(platform === "shopware" ? t("integrations.clientId") : platform === "wordpress" ? t("integrations.username") : t("integrations.consumerKey")).toUpperCase()}</label>
                    <input value={key} onChange={(e) => setKey(e.target.value)} className="w-full px-4 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
                  </div>
                )}
                {!OAUTH2_PLATFORMS.has(platform) && (
                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
                      {(platform === "lexoffice" || platform === "toggl" ? t("integrations.apiKey") : platform === "wordpress" ? t("integrations.applicationPassword") : platform === "shopware" ? t("integrations.clientSecret") : TOKEN_AUTH_PLATFORMS.has(platform) ? t("integrations.accessToken") : t("integrations.consumerSecret")).toUpperCase()}
                    </label>
                    <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" className="w-full px-4 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" placeholder={platform === "shopify" ? "shpat_..." : undefined} />
                  </div>
                )}
                {OAUTH2_PLATFORMS.has(platform) && (
                  <div className="space-y-5">
                    <div>
                      <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("integrations.bankCountry").toUpperCase()}</label>
                      <div className="flex gap-2">
                        <input value={bankCountry} onChange={(e) => setBankCountry(e.target.value.toLowerCase())} maxLength={2} className="w-20 px-4 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary uppercase" placeholder="de" />
                        <button type="button" disabled={institutionsBusy} onClick={searchInstitutions} className="px-4 py-2 border border-primary text-primary font-label-caps text-label-caps rounded hover:bg-primary/5 transition-colors disabled:opacity-60">
                          {t("integrations.searchBanks").toUpperCase()}
                        </button>
                      </div>
                    </div>
                    {institutions.length > 0 && (
                      <div>
                        <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("integrations.selectBank").toUpperCase()}</label>
                        <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} className="w-full px-4 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary">
                          <option value="">—</option>
                          {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </form>

              {result && (
                <div className={"mt-8 p-4 rounded border-l-4 " + (result.ok ? "bg-secondary-container/20 border border-secondary-container border-l-secondary" : "bg-error-container/20 border border-error-container border-l-error")}>
                  <div className="flex items-start gap-3">
                    <span className={"material-symbols-outlined mt-0.5 " + (result.ok ? "text-secondary" : "text-error")}>{result.ok ? "check_circle" : "error"}</span>
                    <p className="font-body-md text-body-md text-on-surface-variant">{result.message}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-gutter border-t border-outline-variant bg-surface-container-lowest sticky bottom-0">
              <button disabled={busy || (OAUTH2_PLATFORMS.has(platform) && !institutionId)} onClick={OAUTH2_PLATFORMS.has(platform) ? connectBank : connect} className="w-full bg-primary hover:bg-on-primary-container text-on-primary font-label-caps text-label-caps px-4 py-3 rounded transition-colors flex justify-center items-center gap-2 disabled:opacity-60">
                {OAUTH2_PLATFORMS.has(platform) ? t("integrations.connectBank").toUpperCase() : t("action.connect").toUpperCase()}
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
