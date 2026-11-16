"use client";

import { Camera, ScanLine } from "lucide-react";
import { IconTile } from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { bilingualCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { ACCEPTED_DOCUMENT_TYPES } from "../lib/verification";

export type PassportScanState = "idle" | "scanning" | "done" | "error";

/**
 * Offers to fill the passport fields from the photo page. Uses the photo
 * chosen in step 1 when there is one; otherwise the photo picked here also
 * becomes the step 1 document. A photo is only read when the tutor presses
 * a button here, next to the note that it goes to Google Gemini.
 * Presentation: a brand-soft well (danger tone on error) with a tone tile,
 * the live status line and one secondary action.
 */
export function PassportScanPanel({
  state,
  error,
  filledCount,
  hasPhoto,
  disabled,
  onScanPhoto,
  onPickPhoto,
}: {
  state: PassportScanState;
  error: string | null;
  filledCount: number;
  hasPhoto: boolean;
  disabled?: boolean;
  onScanPhoto: () => void;
  onPickPhoto: (file: File) => void;
}) {
  const scanning = state === "scanning";
  const message =
    state === "scanning"
      ? t("dashboardSettings.scanScanning")
      : state === "done"
        ? t("dashboardSettings.scanDone").replaceAll("{count}", String(filledCount))
        : state === "error"
          ? error
          : t("dashboardSettings.scanIdle");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-(--radius-ctl) border p-3.5",
        state === "error" ? "border-danger-border bg-danger-bg" : "border-brand-soft-border bg-brand-soft",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconTile icon={ScanLine} tone={state === "error" ? "red" : "brand"} className="bg-surface" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{bilingualCopy(t("dashboardSettings.scanTitle"), { label: true })}</p>
          <p
            className={cn("text-sm leading-[1.6]", state === "error" ? "text-danger-fg" : "text-fg-muted")}
            role={state === "error" ? "alert" : "status"}
          >
            {bilingualCopy(message)}
          </p>
          <p className="mt-1 text-xs leading-[1.6] text-fg-muted">{bilingualCopy(t("dashboardSettings.scanDisclosure"))}</p>
        </div>
      </div>
      {hasPhoto ? (
        <Button
          variant="outline"
          className="w-full shrink-0 sm:ml-[52px] sm:w-auto sm:self-start"
          onClick={onScanPhoto}
          loading={scanning}
          disabled={disabled}
        >
          {state === "idle" ? t("dashboardSettings.scanUsePhoto") : t("dashboardSettings.scanAgain")}
        </Button>
      ) : (
        <label
          className={cn(
            buttonVariants({ variant: "outline" }),
            // Two languages in one label: it wraps to two centred lines where one does not fit (phones under
            // about 380px) instead of running over the outline. Heights are minimums (40, 44 on touch).
            "h-auto min-h-10 w-full shrink-0 cursor-pointer py-1.5 text-center leading-[1.6] whitespace-normal sm:ml-[52px] sm:w-auto sm:self-start",
            "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-focus-ring",
            disabled && "pointer-events-none opacity-45",
          )}
        >
          {/* One inline run: the icon stays beside the first line when the text wraps. */}
          <span className="text-balance-th">
            <Camera aria-hidden="true" className="mr-2 inline-block size-4 align-middle" />
            {t("dashboardSettings.scanPickPhoto")}
          </span>
          <input
            type="file"
            className="sr-only"
            accept={ACCEPTED_DOCUMENT_TYPES}
            disabled={disabled}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              event.target.value = "";
              if (selected) onPickPhoto(selected);
            }}
          />
        </label>
      )}
    </div>
  );
}
