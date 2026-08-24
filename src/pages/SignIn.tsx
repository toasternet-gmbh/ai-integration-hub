import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";

const LOGS = [
  "orders.refund • require_approval • 2 min ago",
  "orders.get • allowed • 5 min ago",
  "users.update_role • denied • 12 min ago",
  "system.health_check • ok • 15 min ago",
  "inventory.sync • allowed • 22 min ago",
  "orders.create • allowed • 28 min ago",
  "payment.process • require_approval • 35 min ago",
  "users.login • allowed • 41 min ago",
];

function statusColor(log: string) {
  if (log.includes("denied")) return "text-error";
  if (log.includes("require_approval")) return "text-tertiary-fixed-dim";
  return "text-secondary-fixed";
}

export default function SignIn() {
  const { lang, setLang, t } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pos = 0;
    let raf = 0;
    const el = logRef.current;
    function scroll() {
      pos -= 0.4;
      if (pos <= -900) pos = 0;
      if (el) el.style.transform = `translateY(${pos}px)`;
      raf = requestAnimationFrame(scroll);
    }
    raf = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(raf);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      if (error) setErr(error.message); else setResetSent(true);
      return;
    }

    const { error } = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  }

  return (
    <div className="bg-background flex items-center justify-center min-h-screen font-body-md text-on-surface">
      <div className="flex flex-col w-full min-h-screen md:flex-row bg-background">
        <div className="hidden md:flex flex-col flex-1 bg-surface-container relative overflow-hidden border-r border-outline-variant">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#191c1e 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
          <div className="p-margin-page border-b border-outline-variant relative z-10 bg-surface-container/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span className="font-label-caps text-label-caps text-on-surface">SYSTEM_LOGS_ACTIVE</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative z-0 opacity-40">
            <div ref={logRef} className="absolute w-full flex flex-col font-mono-data text-mono-data text-on-surface-variant p-6 gap-3">
              {Array.from({ length: 30 }, (_, i) => LOGS[i % LOGS.length]).map((log, i) => {
                const [tool, status, when] = log.split("•").map((s) => s.trim());
                return (
                  <div key={i} className="flex items-center gap-3 py-1 border-b border-outline-variant/30">
                    <span className={statusColor(log)}>[{status.toUpperCase()}]</span>
                    <span>{tool}</span>
                    <span className="ml-auto opacity-50">{when}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-surface relative">
          <div className="absolute top-0 right-0 p-6 flex justify-end">
            <div className="flex items-center border border-outline-variant rounded p-1 bg-surface-container-lowest">
              <button onClick={() => setLang("en")} className={"px-3 py-1 font-label-caps text-label-caps rounded " + (lang === "en" ? "bg-surface-variant text-on-surface" : "text-on-surface-variant hover:text-on-surface")}>EN</button>
              <button onClick={() => setLang("de")} className={"px-3 py-1 font-label-caps text-label-caps rounded " + (lang === "de" ? "bg-surface-variant text-on-surface" : "text-on-surface-variant hover:text-on-surface")}>DE</button>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 w-full max-w-md mx-auto">
            <div className="w-full flex flex-col gap-component-gap">
              {mode !== "forgot" && (
                <div className="flex border-b border-outline-variant mb-6">
                  <button onClick={() => setMode("signin")} className={"flex-1 pb-3 font-label-caps text-label-caps relative -mb-[1px] bg-transparent border-0 border-b-2 " + (mode === "signin" ? "text-primary border-primary" : "text-on-surface-variant border-transparent hover:text-on-surface")}>
                    {t("signin.tab.signin").toUpperCase()}
                  </button>
                  <button onClick={() => setMode("signup")} className={"flex-1 pb-3 font-label-caps text-label-caps relative -mb-[1px] bg-transparent border-0 border-b-2 " + (mode === "signup" ? "text-primary border-primary" : "text-on-surface-variant border-transparent hover:text-on-surface")}>
                    {t("signin.tab.signup").toUpperCase()}
                  </button>
                </div>
              )}
              <div className="mb-4">
                <h1 className="font-headline-md text-headline-md text-on-surface mb-2">{mode === "forgot" ? t("signin.forgot.title") : t("signin.title")}</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">{mode === "forgot" ? t("signin.forgot.subtitle") : t("signin.subtitle")}</p>
              </div>

              {mode === "forgot" && resetSent ? (
                <p className="font-body-md text-body-md text-secondary">{t("signin.forgot.sent")}</p>
              ) : (
              <form className="flex flex-col gap-component-gap" onSubmit={submit}>
                <div className="flex flex-col">
                  <label className="font-label-caps text-label-caps text-on-surface-variant mb-1">{t("signin.email").toUpperCase()}</label>
                  <input
                    className="bg-surface-container-lowest border border-outline-variant text-on-surface font-mono-data text-mono-data p-3 outline-none focus:border-primary transition-colors"
                    placeholder="user@domain.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  />
                </div>
                {mode !== "forgot" && (
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-label-caps text-label-caps text-on-surface-variant">{t("signin.password").toUpperCase()}</label>
                      {mode === "signin" && (
                        <button type="button" onClick={() => { setMode("forgot"); setErr(null); }} className="font-body-md text-[12px] text-primary hover:underline bg-transparent border-none p-0 cursor-pointer">
                          {t("signin.forgotLink")}
                        </button>
                      )}
                    </div>
                    <input
                      className="bg-surface-container-lowest border border-outline-variant text-on-surface font-mono-data text-mono-data p-3 outline-none focus:border-primary transition-colors"
                      placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                    />
                  </div>
                )}
                {err && <p className="text-error font-body-md text-body-md">{err}</p>}
                <button disabled={busy} type="submit" className="mt-4 bg-primary text-on-primary font-label-caps text-label-caps py-[14px] px-6 rounded hover:bg-primary-container transition-colors w-full flex items-center justify-center gap-2 disabled:opacity-60">
                  <span>{busy ? "…" : mode === "forgot" ? t("signin.forgot.submit").toUpperCase() : t("signin.submit").toUpperCase()}</span>
                  {!busy && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
                </button>
                {mode === "forgot" && (
                  <button type="button" onClick={() => { setMode("signin"); setErr(null); }} className="font-body-md text-body-md text-on-surface-variant hover:text-primary bg-transparent border-none cursor-pointer">
                    &larr; {t("signin.tab.signin")}
                  </button>
                )}
                {mode === "signup" && (
                  <p className="font-body-md text-[12px] text-on-surface-variant text-center">
                    {t("signin.agreePrefix")} <Link to="/terms" target="_blank" className="text-primary hover:underline">{t("footer.terms")}</Link> {t("signin.agreeAnd")} <Link to="/privacy" target="_blank" className="text-primary hover:underline">{t("footer.privacy")}</Link>.
                  </p>
                )}
              </form>
              )}
              <Link to="/" className="text-on-surface-variant text-body-md hover:text-primary mt-6 no-underline">&larr; Back to site</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
