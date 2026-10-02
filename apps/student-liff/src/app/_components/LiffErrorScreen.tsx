import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ChevronDown, KeyRound, RotateCw, Wrench, WifiOff } from "lucide-react";
import type { IconTileTone } from "@/components/mobile/IconTile";
import { Screen } from "@/components/mobile/Screen";
import { StatusScreen } from "@/components/mobile/Feedback";
import { Button } from "@/components/ui/button";
import { t, type I18nKey } from "@/lib/i18n";
import type { LiffErrorKind } from "./liffErrors";

const ERROR_COPY: Record<LiffErrorKind, { icon: LucideIcon; tone: IconTileTone; title: I18nKey; description: I18nKey }> = {
  network: { icon: WifiOff, tone: "neutral", title: "entry.errorNetworkTitle", description: "entry.errorNetworkDescription" },
  config: { icon: Wrench, tone: "amber", title: "entry.errorConfigTitle", description: "entry.errorConfigDescription" },
  auth: { icon: KeyRound, tone: "amber", title: "entry.errorAuthTitle", description: "entry.errorAuthDescription" },
  session: { icon: KeyRound, tone: "amber", title: "entry.errorAuthTitle", description: "entry.errorSessionDescription" },
  unknown: { icon: AlertTriangle, tone: "amber", title: "entry.errorUnknownTitle", description: "entry.errorUnknownDescription" },
};

export interface LiffErrorScreenProps {
  kind: LiffErrorKind;
  /** Technical message (LiffProvider `error`), shown only inside the collapsed "รายละเอียด". */
  details?: string | null;
  onRetry: () => void;
  retrying?: boolean;
}

/** Friendly full-screen LIFF start-up error: icon, plain Thai, one retry, optional technical details. */
export function LiffErrorScreen({ kind, details, onRetry, retrying }: LiffErrorScreenProps) {
  const copy = ERROR_COPY[kind];
  return (
    <Screen>
      <StatusScreen
        icon={copy.icon}
        tone={copy.tone}
        title={t(copy.title)}
        description={t(copy.description)}
        primaryAction={
          <Button variant="brand" size="cta" className="w-full" onClick={onRetry} loading={retrying}>
            {retrying ? null : <RotateCw aria-hidden="true" />}
            {t("common.retry")}
          </Button>
        }
        secondaryAction={
          details ? (
            <details className="group text-left">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-xl text-sm font-semibold text-fg-muted select-none active:bg-press [&::-webkit-details-marker]:hidden">
                {t("entry.errorDetails")}
                <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-1 rounded-xl border border-hairline bg-surface p-3">
                <p className="text-xs leading-[1.5] text-fg-muted">{t("entry.errorDetailsHint")}</p>
                <p className="mt-2 font-mono text-xs leading-[1.5] break-words text-fg select-text">{details}</p>
              </div>
            </details>
          ) : null
        }
      />
    </Screen>
  );
}
