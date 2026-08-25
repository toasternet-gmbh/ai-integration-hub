import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";

type Ctx = { projectId: string };
type Integration = { id: string; platform: string; name: string; status: string; error_status: string | null };

const PLATFORM_ICON: Record<string, string> = { woocommerce: "shopping_cart", shopware: "storefront", shopify: "local_mall", magento: "inventory" };
const PLATFORMS = [
  { id: "woocommerce", icon: "shopping_cart", label: "WooCommerce", disabled: false },
  { id: "shopware", icon: "storefront", label: "Shopware 6", disabled: false },
  { id: "shopify", icon: "local_mall", label: "Shopify", disabled: false },
  { id: "magento", icon: "inventory", label: "Magento", disabled: false },
];

const TOKEN_AUTH_PLATFORMS = new Set(["shopify", "magento"]);

export default function Integrations() {
  const { projectId } = useOutletContext<Ctx>();
  const { t } = useI18n();
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

  async function reload() {
    try { setRows(await mcp<Integration[]>("list_integrations", {}, { projectId })); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  async function connect() {
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const credentials =
        platform === "shopware" ? { storeUrl, clientId: key, clientSecret: secret }
        : TOKEN_AUTH_PLATFORMS.has(platform) ? { storeUrl, accessToken: secret }
        : { storeUrl, consumerKey: key, consumerSecret: secret };
      await mcp("create_integration", { platform, name, credentials }, { projectId });
      setResult({ ok: true, message: `Connected — 3 capabilities discovered: orders.search, orders.get, orders.refund` });
      setName(""); setStoreUrl(""); setKey(""); setSecret("");
      reload();
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
      <div className="px-margin-page py-margin-page flex items-center justify-between border-b border-outline-variant bg-surface-container-low/50">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("integrations.title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-unit">{t("integrations.subtitle")}</p>
        </div>
        <button onClick={() => setOpen(true)} className="bg-primary hover:bg-on-primary-container text-on-primary font-label-caps text-label-caps px-4 py-2 rounded flex items-center gap-2 transition-colors">
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
              <div key={r.id} className="flex items-center justify-between p-gutter hover:bg-surface-container-lowest transition-colors border-b border-outline-variant last:border-b-0">
                <div className="flex items-center gap-gutter">
                  <div className="w-12 h-12 flex items-center justify-center bg-surface-container border border-outline-variant rounded">
                    <span className="material-symbols-outlined text-on-surface-variant text-[24px]">{PLATFORM_ICON[r.platform] ?? "hub"}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">{r.name}</h3>
                      <div className={"h-6 px-2 flex items-center gap-2 border rounded-full " + (r.status === "connected" ? "bg-surface-container border-secondary/30" : "bg-error-container border-error/30")}>
                        <span className={"w-1.5 h-1.5 rounded-full " + (r.status === "connected" ? "bg-secondary" : "bg-error")} />
                        <span className="font-label-caps text-label-caps text-on-surface">{r.status === "connected" ? t("status.connected").toUpperCase() : r.status.toUpperCase()}</span>
                      </div>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1 flex items-center gap-2">
                      <span className="font-mono-data text-mono-data text-on-surface">{r.platform}</span>
                      {r.error_status && <><span>•</span><span className="text-error">{r.error_status}</span></>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => testConnection(r.id)} className="px-4 py-2 border border-primary text-primary font-label-caps text-label-caps rounded hover:bg-primary/5 transition-colors">
                    {t("action.testConnection").toUpperCase()}
                  </button>
                  <button onClick={() => disconnect(r.id, r.name)} className="w-9 h-9 flex items-center justify-center border border-outline-variant text-on-surface-variant hover:text-error hover:border-error rounded transition-colors bg-transparent">
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
                <div className="grid grid-cols-2 gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      disabled={p.disabled}
                      onClick={() => setPlatform(p.id)}
                      className={
                        "flex flex-col items-center justify-center p-4 rounded relative transition-colors " +
                        (p.disabled
                          ? "border border-outline-variant/30 bg-surface opacity-50 cursor-not-allowed"
                          : platform === p.id
                          ? "border-2 border-primary bg-primary/5"
                          : "border border-outline-variant bg-surface hover:border-primary")
                      }
                    >
                      <span className={"material-symbols-outlined text-[28px] mb-2 " + (platform === p.id && !p.disabled ? "text-primary" : "text-on-surface-variant")}>{p.icon}</span>
                      <span className={"font-body-md text-body-md font-semibold " + (platform === p.id && !p.disabled ? "text-primary" : "text-on-surface")}>{p.label}</span>
                      {p.disabled && <span className="font-label-caps text-label-caps text-on-surface-variant mt-1">{t("integrations.comingSoon").toUpperCase()}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("integrations.name").toUpperCase()}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" placeholder="Main Store" />
                </div>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("integrations.storeUrl").toUpperCase()}</label>
                  <input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} className="w-full px-4 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" placeholder="https://your-store.com" type="url" />
                </div>
                {!TOKEN_AUTH_PLATFORMS.has(platform) && (
                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{(platform === "shopware" ? t("integrations.clientId") : t("integrations.consumerKey")).toUpperCase()}</label>
                    <input value={key} onChange={(e) => setKey(e.target.value)} className="w-full px-4 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
                  </div>
                )}
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
                    {(platform === "shopware" ? t("integrations.clientSecret") : TOKEN_AUTH_PLATFORMS.has(platform) ? t("integrations.accessToken") : t("integrations.consumerSecret")).toUpperCase()}
                  </label>
                  <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" className="w-full px-4 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" placeholder={platform === "shopify" ? "shpat_..." : undefined} />
                </div>
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
              <button disabled={busy} onClick={connect} className="w-full bg-primary hover:bg-on-primary-container text-on-primary font-label-caps text-label-caps px-4 py-3 rounded transition-colors flex justify-center items-center gap-2 disabled:opacity-60">
                {t("action.connect").toUpperCase()}
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
