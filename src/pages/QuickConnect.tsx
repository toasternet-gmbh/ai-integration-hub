import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { PublicShell } from "../components/PublicShell";
import { PlatformCredentialFields } from "../components/PlatformCredentialFields";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/useSession";
import { supabase } from "../lib/supabase";
import { mcp } from "../lib/mcp";
import { storageKey } from "../App";
import { PLATFORM_CATALOG, platformToolList, VERIFICATION_LABEL, VERIFICATION_TONE } from "../lib/platformCatalog";
import { buildCredentials, OAUTH2_PLATFORMS } from "../lib/platformCredentials";

export default function QuickConnect() {
  const { platformId } = useParams<{ platformId: string }>();
  const { t, path, lang } = useI18n();
  const navigate = useNavigate();
  const signedIn = useSession();

  const platform = PLATFORM_CATALOG.find((p) => p.id === platformId);

  const [name, setName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null);

  if (!platform) return <Navigate to={path("/blueprint")} replace />;
  // Already signed in (e.g. clicked this link while logged in) — this page is for the
  // anonymous-visitor case only; hand off to the normal picker, pre-selected.
  if (signedIn) return <Navigate to={`${path("/app/integrations")}?platform=${platform.id}`} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!platform) return;
    if (!name.trim()) return setErr(t("quickConnect.errName"));
    if (!agree) return setErr(t("quickConnect.errAgree"));
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (!data.session) {
        setConfirmEmailFor(email);
        setBusy(false);
        return;
      }

      const orgName = `${email.split("@")[0]}'s Organization`;
      const org = await mcp<{ id: string; name: string }>("create_organization", { name: orgName });
      const project = await mcp<{ id: string; name: string }>("create_project", { organization_id: org.id, name: "Default project" });
      localStorage.setItem(
        storageKey(data.session.user.id),
        JSON.stringify({ orgId: org.id, orgName: org.name, projectId: project.id, projectName: project.name }),
      );

      const credentials = buildCredentials(platform.id, { storeUrl, key, secret });
      try {
        await mcp("create_integration", { platform: platform.id, name: name.trim(), credentials }, { projectId: project.id });
      } catch {
        // Account/org/project already exist even if the connection itself failed (bad
        // credentials, unreachable host, ...) — land them in the app to see why and retry,
        // rather than losing the account they just created over a connection error.
        navigate(`${path("/app/integrations")}?platform=${platform.id}`);
        return;
      }
      navigate(path("/app/integrations"));
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto px-margin-page py-margin-page">
        <div className="max-w-2xl mb-10">
          <span className="font-label-caps text-label-caps text-primary">{t("quickConnect.eyebrow")}</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-2 mb-3">
            {t("quickConnect.title").replace("{platform}", platform.name)}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t("quickConnect.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-5">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sticky top-24">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${platform.color}1a`, color: platform.color }}>
                  <span className="material-symbols-outlined text-[22px]">{platform.icon}</span>
                </div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{platform.name}</h2>
              </div>
              <span className={`inline-block font-label-caps text-[10px] leading-none px-2 py-1 rounded-full whitespace-nowrap mb-3 ${VERIFICATION_TONE[platform.verificationStatus]}`}>
                {VERIFICATION_LABEL[platform.verificationStatus][lang]}
              </span>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-4">{platform.description[lang]}</p>
              <span className="block font-label-caps text-label-caps text-on-surface-variant mb-2">{t("quickConnect.toolsHeading")}</span>
              <div className="flex flex-wrap gap-1.5">
                {platformToolList(platform).map(({ tool, description }) => (
                  <span key={tool} title={description[lang]} className="font-mono-data text-[11px] leading-none px-2 py-1 rounded-full bg-surface-container text-on-surface-variant">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {OAUTH2_PLATFORMS.has(platform.id) ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                  {t("quickConnect.oauthUnsupported").replace("{platform}", platform.name)}
                </p>
                <Link
                  to={path("/signin")}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-on-primary-container text-on-primary font-label-caps text-label-caps px-4 py-3 rounded transition-colors no-underline"
                >
                  {t("quickConnect.oauthCta").toUpperCase()}
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            ) : confirmEmailFor ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">{t("quickConnect.confirmEmailTitle")}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t("quickConnect.confirmEmailBody").replace("{email}", confirmEmailFor)}
                </p>
              </div>
            ) : (
              <form className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-6" onSubmit={submit}>
                <div>
                  <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-3">{t("quickConnect.accountHeading")}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("signin.email").toUpperCase()}</label>
                      <input
                        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface text-on-surface focus:outline-none focus:border-primary"
                        placeholder="you@company.com"
                      />
                    </div>
                    <div>
                      <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("signin.password").toUpperCase()}</label>
                      <input
                        type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface text-on-surface focus:outline-none focus:border-primary"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-3">{t("quickConnect.connectionHeading")}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{t("integrations.name").toUpperCase()}</label>
                      <input
                        value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface text-on-surface focus:outline-none focus:border-primary"
                        placeholder="Main Store"
                      />
                    </div>
                    <PlatformCredentialFields
                      platform={platform.id} storeUrl={storeUrl} onStoreUrl={setStoreUrl} keyValue={key} onKey={setKey} secret={secret} onSecret={setSecret}
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 font-body-md text-[12px] text-on-surface-variant">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
                  <span>
                    {t("signin.agreePrefix")} <Link to={path("/terms")} target="_blank" className="text-primary hover:underline">{t("footer.terms")}</Link> {t("signin.agreeAnd")} <Link to={path("/privacy")} target="_blank" className="text-primary hover:underline">{t("footer.privacy")}</Link>.
                  </span>
                </label>

                {err && <p className="text-error font-body-md text-body-md">{err}</p>}

                <button
                  disabled={busy} type="submit"
                  className="w-full bg-primary hover:bg-on-primary-container text-on-primary font-label-caps text-label-caps px-4 py-3 rounded transition-colors flex justify-center items-center gap-2 disabled:opacity-60"
                >
                  {busy ? "…" : t("quickConnect.submit").toUpperCase()}
                  {!busy && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
                </button>

                <p className="font-body-md text-[12px] text-on-surface-variant text-center">
                  {t("quickConnect.alreadyHaveAccount")} <Link to={path("/signin")} className="text-primary hover:underline">{t("quickConnect.signIn")}</Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
