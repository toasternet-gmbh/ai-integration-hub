import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { platformToolList, type PlatformMeta } from "../lib/platformCatalog";
import { TOOL_DEMOS } from "../lib/toolDemos";

/** Interactive, non-developer "try it" demo for the quick-connect page — click an action to see
 *  an invented example exchange ("you ask" / "the Hub replies"). Nothing here calls a real
 *  integration; a visitor hasn't connected one yet at this point in the flow. Real per-connector
 *  capabilities still come from `platformToolList` (mirroring each connector's own
 *  getCapabilities()) — this only adds plain-language copy on top for tools that have it. */
export function ToolTesterDemo({ platform }: { platform: PlatformMeta }) {
  const { t, lang } = useI18n();
  const [openTool, setOpenTool] = useState<string | null>(null);

  const tools = platformToolList(platform)
    .map(({ tool }) => ({ tool, demo: TOOL_DEMOS[tool] }))
    .filter((x) => Boolean(x.demo));

  if (tools.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {tools.map(({ tool, demo }) => {
        const isOpen = openTool === tool;
        return (
          <div key={tool} className="border border-outline-variant rounded-lg overflow-hidden bg-surface">
            <button
              onClick={() => setOpenTool(isOpen ? null : tool)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-surface-container transition-colors"
            >
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[18px]">{demo.icon}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-body-md text-body-md font-medium text-on-surface">{demo.label[lang]}</span>
                <span className="block font-body-md text-[12px] text-on-surface-variant leading-snug mt-0.5">{demo.benefit[lang]}</span>
              </span>
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">{isOpen ? "expand_less" : "expand_more"}</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 flex flex-col gap-2.5 bg-surface-container-lowest border-t border-outline-variant">
                <div className="flex items-start gap-2.5 mt-2">
                  <span className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">person</span>
                  </span>
                  <div className="min-w-0">
                    <span className="block font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wide mb-0.5">{t("quickConnect.demoAgentLabel")}</span>
                    <p className="font-body-md text-[13px] text-on-surface italic leading-snug">&ldquo;{demo.agentAsks[lang]}&rdquo;</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[14px] text-primary">smart_toy</span>
                  </span>
                  <div className="min-w-0">
                    <span className="block font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wide mb-0.5">{t("quickConnect.demoHubLabel")}</span>
                    <p className="font-body-md text-[13px] text-on-surface leading-snug">{demo.hubReplies[lang]}</p>
                  </div>
                </div>
                <p className="font-body-md text-[11px] text-on-surface-variant/70 pl-9">{t("quickConnect.demoSampleNote")}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
