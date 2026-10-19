"use client";

import { Camera, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ACCEPTED_DOCUMENT_TYPES } from "../lib/verification";

export type PassportScanState = "idle" | "scanning" | "done" | "error";

/**
 * Offers to fill the passport fields from the photo page. Uses the photo
 * chosen in step 1 when there is one; otherwise the photo picked here also
 * becomes the step 1 document. A photo is only read when the tutor presses
 * a button here, next to the note that it goes to Google Gemini.
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
        "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center",
        state === "error" ? "border-danger-border bg-danger-bg" : "border-brand-soft-border bg-brand-soft/40",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ScanLine
          aria-hidden="true"
          className={cn("mt-0.5 size-5 shrink-0", state === "error" ? "text-danger-fg" : "text-brand-fg")}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{t("dashboardSettings.scanTitle")}</p>
          <p
            className={cn("text-[0.8125rem]", state === "error" ? "text-danger-fg" : "text-fg-muted")}
            role={state === "error" ? "alert" : "status"}
          >
            {message}
          </p>
          <p className="mt-1 text-xs text-fg-subtle">{t("dashboardSettings.scanDisclosure")}</p>
        </div>
      </div>
      {hasPhoto ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full shrink-0 sm:w-auto"
          onClick={onScanPhoto}
          loading={scanning}
          disabled={disabled}
        >
          {state === "idle" ? t("dashboardSettings.scanUsePhoto") : t("dashboardSettings.scanAgain")}
        </Button>
      ) : (
        <label
          className={cn(
            "inline-flex h-8 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-field-border bg-surface px-3 text-sm font-medium text-fg hover:bg-press sm:w-auto",
            "focus-within:ring-2 focus-within:ring-ring/40",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <Camera aria-hidden="true" className="size-4" />
          {t("dashboardSettings.scanPickPhoto")}
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
