import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { CATEGORY_LABEL, platformsByCategory, platformToolList, VERIFICATION_LABEL, VERIFICATION_TONE } from "../lib/platformCatalog";
import { TOOL_DEMOS } from "../lib/toolDemos";

/** The platform grid used both as the promoted picker on Landing and as the dedicated /connect
 * page — one place to keep the "which platforms can I connect" experience in sync. */
export function PlatformPicker() {
  const { t, path, lang } = useI18n();
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return platformsByCategory();
    return platformsByCategory()
      .map((group) => ({
        ...group,
        platforms: group.platforms.filter((p) => {
          if (p.name.toLowerCase().includes(q) || p.description[lang].toLowerCase().includes(q)) return true;
          return platformToolList(p).some(({ tool, description }) => tool.includes(q) || description[lang].toLowerCase().includes(q));
        }),
      }))
      .filter((g) => g.platforms.length > 0);
  }, [search, lang]);

  return (
    <div className="flex flex-col gap-8">
      <div className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("connect.searchPlaceholder")}
          className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-full font-body-md text-body-md bg-surface text-on-surface focus:outline-none focus:border-primary"
        />
      </div>

      {groups.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">{t("connect.noResults").replace("{query}", search)}</p>
      ) : (
        <div className="flex flex-col gap-12">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-4 tracking-wide">{CATEGORY_LABEL[group.category][lang]}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.platforms.map((p) => (
                  <div key={p.id} className="flex items-start gap-4 p-6 bg-surface-container-lowest border border-outline-variant rounded-lg hover:border-primary/40 hover:shadow-card transition-all">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.color}1a`, color: p.color }}>
                      <span className="material-symbols-outlined text-[22px]">{p.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-headline-sm text-headline-sm text-on-surface">{p.name}</h4>
                        <span className={`font-label-caps text-[10px] leading-none px-2 py-1 rounded-full whitespace-nowrap ${VERIFICATION_TONE[p.verificationStatus]}`}>
                          {VERIFICATION_LABEL[p.verificationStatus][lang]}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{p.description[lang]}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {platformToolList(p).map(({ tool }) => (
                          <span
                            key={tool}
                            title={TOOL_DEMOS[tool]?.benefit[lang]}
                            className="font-body-md text-[11px] leading-none px-2 py-1 rounded-full bg-surface-container text-on-surface-variant"
                          >
                            {TOOL_DEMOS[tool]?.label[lang] ?? tool}
                          </span>
                        ))}
                      </div>
                      <Link to={path(`/connect/${p.id}`)} className="inline-flex items-center gap-1 mt-3 font-label-caps text-label-caps text-primary hover:underline no-underline">
                        {t("quickConnect.cardCta").toUpperCase()}
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
