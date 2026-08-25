import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";

/** Landing page for a GoTrue recovery link (?type=recovery in the fragment). supabase-js's default
 *  detectSessionInUrl parses that fragment into a real (temporary) session before this component
 *  ever mounts, so by the time we're here the user is already authenticated — we just need their
 *  new password via updateUser(). */
export default function ResetPassword() {
  const { t, path } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) { setErr(t("resetPassword.tooShort")); return; }
    if (password !== confirm) { setErr(t("resetPassword.mismatch")); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => navigate(path("/app")), 1500);
  }

  return (
    <div className="bg-background flex items-center justify-center min-h-screen font-body-md text-on-surface p-6">
      <div className="w-full max-w-sm flex flex-col gap-component-gap">
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">{t("resetPassword.title")}</h1>

        {!ready && !done && (
          <p className="font-body-md text-body-md text-on-surface-variant">{t("resetPassword.invalidLink")}</p>
        )}

        {ready && !done && (
          <form className="flex flex-col gap-component-gap" onSubmit={submit}>
            <div className="flex flex-col">
              <label className="font-label-caps text-label-caps text-on-surface-variant mb-1">{t("resetPassword.newPassword").toUpperCase()}</label>
              <input
                className="bg-surface-container-lowest border border-outline-variant text-on-surface font-mono-data text-mono-data p-3 outline-none focus:border-primary transition-colors"
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              />
            </div>
            <div className="flex flex-col">
              <label className="font-label-caps text-label-caps text-on-surface-variant mb-1">{t("resetPassword.confirmPassword").toUpperCase()}</label>
              <input
                className="bg-surface-container-lowest border border-outline-variant text-on-surface font-mono-data text-mono-data p-3 outline-none focus:border-primary transition-colors"
                type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6}
              />
            </div>
            {err && <p className="text-error font-body-md text-body-md">{err}</p>}
            <button disabled={busy} type="submit" className="mt-2 bg-primary text-on-primary font-label-caps text-label-caps py-[14px] px-6 rounded hover:bg-on-primary-container transition-colors w-full disabled:opacity-60">
              {busy ? "…" : t("resetPassword.submit").toUpperCase()}
            </button>
          </form>
        )}

        {done && <p className="font-body-md text-body-md text-secondary">{t("resetPassword.success")}</p>}

        <Link to={path("/signin")} className="text-on-surface-variant text-body-md hover:text-primary mt-4 no-underline">&larr; {t("resetPassword.backToSignIn")}</Link>
      </div>
    </div>
  );
}
