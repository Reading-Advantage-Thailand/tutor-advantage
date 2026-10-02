"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Notice } from "./Feedback";
import { TextAreaField, TextField } from "./Fields";
import { Sheet } from "./Sheet";

export interface ConfirmReasonOptions {
  label?: string;
  placeholder?: string;
  /** Minimum characters (default 5 when required). */
  minLength?: number;
  /** Default true. When false the field is optional. */
  required?: boolean;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger = red destructive action (money, identity, roles, deletes); brand = green (default). */
  tone?: "brand" | "danger";
  /**
   * Runs on confirm with the typed reason. Return a promise: the button spins,
   * the dialog can't be dismissed, it closes on success and shows the Thai
   * error inline on failure (so the admin can retry).
   */
  onConfirm: (context: { reason: string }) => unknown;
  /** Spinner + no dismiss (only needed when you manage loading yourself). */
  loading?: boolean;
  /** Type-to-confirm: the confirm button stays disabled until this exact text is typed (e.g. the period "2026-08" or a user's email). */
  requireText?: string;
  /** Ask for a reason (audit note). `true` = required, default label. */
  reason?: boolean | ConfirmReasonOptions;
  /**
   * Facts the admin is confirming (amounts, counts, names) shown in a
   * highlighted box, e.g. <DescriptionList items={[{ label: "ยอดรวม", value: formatSatang(total) }]} />.
   */
  details?: ReactNode;
  /** Show "การดำเนินการนี้ย้อนกลับไม่ได้" under the description. */
  irreversible?: boolean;
  children?: ReactNode;
}

/**
 * Confirmation for every money / identity / role / destructive action.
 * Bottom sheet on phones, dialog on desktop. Optional type-to-confirm and
 * required reason. Copy should state amounts and counts ("โอนเงิน 12 รายการ
 * รวม ฿45,000"), never just "ยืนยัน?".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "brand",
  onConfirm,
  loading: loadingProp = false,
  requireText,
  reason,
  details,
  irreversible,
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [typed, setTyped] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  // Fresh state each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTyped("");
    setReasonText("");
    setReasonTouched(false);
    setError(null);
  }, [open]);

  const reasonOptions: ConfirmReasonOptions | null = reason ? (reason === true ? {} : reason) : null;
  const reasonRequired = reasonOptions ? reasonOptions.required !== false : false;
  const minLength = reasonOptions?.minLength ?? (reasonRequired ? 5 : 0);
  const reasonValid = !reasonOptions || (!reasonRequired && reasonText.trim().length === 0) || reasonText.trim().length >= minLength;
  const typedValid = !requireText || typed.trim() === requireText;
  const loading = loadingProp || pending;
  const canConfirm = reasonValid && typedValid && !loading;

  const handleConfirm = async () => {
    setReasonTouched(true);
    if (!reasonValid || !typedValid || loading) return;
    setError(null);
    const result = onConfirm({ reason: reasonText.trim() });
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setPending(true);
      try {
        await result;
        onOpenChange(false);
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setPending(false);
      }
    }
  };

  const hasBody = Boolean(children || details || requireText || reasonOptions || error || irreversible);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (loading && !next) return;
        onOpenChange(next);
      }}
      title={
        tone === "danger" ? (
          <span className="flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-1 size-5 shrink-0 text-danger-fg" />
            <span>{title}</span>
          </span>
        ) : (
          title
        )
      }
      description={description}
      showClose={false}
      dismissible={!loading}
      width={480}
      bodyClassName={hasBody ? undefined : "hidden"}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" size="lg" className="md:h-9 md:px-3.5" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t("shell.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={tone === "danger" ? "danger" : "default"}
            size="lg"
            className="md:h-9 md:px-3.5"
            loading={loading}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleConfirm();
        }}
      >
        {irreversible ? <p className="text-sm font-medium text-danger-fg">{t("shell.irreversible")}</p> : null}
        {details ? (
          <div className={cn("rounded-xl border px-4 py-3", tone === "danger" ? "border-danger-border bg-danger-bg/50" : "border-hairline bg-surface-muted")}>
            {details}
          </div>
        ) : null}
        {children}
        {reasonOptions ? (
          <TextAreaField
            label={reasonOptions.label ?? t("shell.reasonLabel")}
            placeholder={reasonOptions.placeholder ?? t("shell.reasonPlaceholder")}
            required={reasonRequired}
            optional={!reasonRequired}
            rows={3}
            value={reasonText}
            disabled={loading}
            onChange={(event) => setReasonText(event.target.value)}
            onBlur={() => setReasonTouched(true)}
            error={reasonTouched && !reasonValid ? t("shell.reasonTooShort", { min: minLength }) : undefined}
            maxLength={1000}
          />
        ) : null}
        {requireText ? (
          <TextField
            label={
              <>
                {t("shell.typeToConfirm").split("{text}")[0]}
                <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-fg">{requireText}</code>
                {t("shell.typeToConfirm").split("{text}")[1]}
              </>
            }
            value={typed}
            disabled={loading}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => setTyped(event.target.value)}
            error={typed && !typedValid ? t("shell.typeToConfirmMismatch") : undefined}
          />
        ) : null}
        {error ? (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        ) : null}
      </form>
    </Sheet>
  );
}
