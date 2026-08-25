import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";

type Ctx = { projectId: string };
type Member = { user_id: string; email: string; role: string; created_at: string };

export default function Team() {
  const { projectId } = useOutletContext<Ctx>();
  const { t } = useI18n();
  const [rows, setRows] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "owner">("member");
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try { setRows(await mcp<Member[]>("list_project_members", {}, { projectId })); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, [projectId]);

  async function invite() {
    if (!email.trim()) { setErr(t("team.emailRequired")); return; }
    setErr(null);
    setBusy(true);
    try {
      const result = await mcp<{ invite_link: string | null }>("invite_project_member", { email: email.trim(), role }, { projectId });
      setEmail("");
      if (result.invite_link) setInviteLink(result.invite_link);
      reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function remove(userId: string) {
    try { await mcp("remove_project_member", { user_id: userId }, { projectId }); reload(); } catch (e) { setErr((e as Error).message); }
  }

  async function changeRole(userId: string, newRole: string) {
    try { await mcp("update_project_member_role", { user_id: userId, role: newRole }, { projectId }); reload(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col w-full h-full relative font-body-md text-on-surface">
      <div className="px-margin-page py-gutter flex flex-col gap-margin-page max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t("team.title")}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-unit">{t("team.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
              placeholder={t("team.emailPlaceholder")}
              type="email"
              className="px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
            />
            <select
              value={role} onChange={(e) => setRole(e.target.value as "member" | "owner")}
              className="px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="member">{t("team.role.member")}</option>
              <option value="owner">{t("team.role.owner")}</option>
            </select>
            <button disabled={busy} onClick={invite} className="bg-primary text-on-primary px-gutter py-2 rounded flex items-center gap-component-gap font-body-md hover:bg-on-primary-container transition-colors disabled:opacity-60">
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              {t("team.invite")}
            </button>
          </div>
        </div>

        {err && <p className="text-error font-body-md text-body-md">{err}</p>}

        <div className="bg-surface-container-lowest flex flex-col rounded">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-gutter px-gutter py-3 border-b border-outline-variant bg-surface-container-low font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider items-center">
            <div>{t("team.col.email")}</div><div>{t("team.col.role")}</div><div>{t("team.col.since")}</div><div className="w-8" />
          </div>
          {rows.length === 0 && <div className="px-gutter py-6 text-on-surface-variant font-body-md text-body-md">{t("team.empty")}</div>}
          {rows.map((m) => (
            <div key={m.user_id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-gutter px-gutter py-4 border-b border-outline-variant last:border-b-0 items-center hover:bg-surface-container transition-colors">
              <div className="font-body-md text-body-md font-bold text-on-surface flex items-center gap-component-gap">
                <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[14px] text-on-secondary-container">person</span>
                </div>
                {m.email}
              </div>
              <div>
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.user_id, e.target.value)}
                  className="px-2 py-1 border border-outline-variant rounded font-label-caps text-label-caps uppercase bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="member">{t("team.role.member")}</option>
                  <option value="owner">{t("team.role.owner")}</option>
                </select>
              </div>
              <div className="font-body-md text-body-md text-on-surface-variant">{new Date(m.created_at).toLocaleDateString()}</div>
              <button onClick={() => remove(m.user_id)} className="text-on-surface-variant hover:text-error transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-surface bg-transparent border-none">
                <span className="material-symbols-outlined text-[20px]">person_remove</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {inviteLink && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg border border-outline-variant shadow-xl">
            <div className="px-gutter py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-headline-md text-headline-md text-on-surface">{t("team.invited")}</h3>
            </div>
            <div className="p-gutter flex flex-col gap-gutter">
              <div className="bg-secondary/10 border border-secondary/30 p-4 rounded flex gap-3">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">info</span>
                <p className="font-body-md text-body-md text-on-surface-variant m-0">{t("team.inviteLinkHint")}</p>
              </div>
              <div className="flex flex-col gap-unit">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">{t("team.inviteLink")}</label>
                <div className="flex">
                  <input readOnly value={inviteLink} className="flex-1 bg-surface-container px-3 py-2 font-mono-data text-mono-data text-on-surface border border-outline-variant border-r-0 focus:outline-none text-[12px]" />
                  <button
                    onClick={() => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="bg-primary text-on-primary px-4 py-2 border border-primary hover:bg-on-primary-container transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">{copied ? "check" : "content_copy"}</span>
                    <span className="font-body-md font-bold">{t("apiKeys.copy")}</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="px-gutter py-4 border-t border-outline-variant bg-surface-container-low flex justify-end">
              <button onClick={() => setInviteLink(null)} className="px-gutter py-2 text-primary font-body-md hover:bg-primary/5 transition-colors bg-transparent border-none">{t("apiKeys.done")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
