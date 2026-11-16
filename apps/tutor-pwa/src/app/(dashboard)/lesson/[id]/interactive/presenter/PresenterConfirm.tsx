"use client";

/**
 * Confirmation inside the presenter. The shared ConfirmDialog is portaled to
 * <body>, which the browser hides while the presenter is in real fullscreen, so
 * a destructive dock action could never be confirmed there. Looks like the
 * shared ConfirmDialog (components.md §10): max 400, radius 16, a warning
 * tone tile, title Noto 600 18, the consequence, cancel (secondary) and the
 * destructive confirm on the right.
 */
import React from "react";
import { TriangleAlert } from "lucide-react";
import { IconTile } from "@/components/app";
import { Button } from "@/components/ui/button";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";

export interface PresenterConfirmProps {
  open: boolean;
  /** A string is kept whole word by word (thaiLabel); a node is rendered as given. */
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PresenterConfirm({ open, title, description, confirmLabel, cancelLabel, onConfirm, onCancel }: PresenterConfirmProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  // Callers pass inline handlers; read the latest one through a ref so a
  // re-render of the presenter does not re-run the open effect (which would
  // pull focus back to Cancel).
  const onCancelRef = React.useRef(onCancel);
  React.useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Start on the safe choice, so a stray Enter or Space does nothing harmful.
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      // Keep Tab inside the dialog: the stage and dock stay mounted behind it.
      const dialog = dialogRef.current;
      const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (!dialog || buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && dialog.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // Give focus back to the control that opened the confirmation.
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-(--z-presenter-modal) flex items-center justify-center bg-(--scrim) p-4"
    >
      <div
        ref={dialogRef}
        className="flex w-full max-w-[400px] flex-col gap-3 rounded-(--radius-dialog) border border-clay-rim bg-surface-elevated p-6 shadow-popover"
      >
        <IconTile icon={TriangleAlert} tone="amber" />
        <h3 id={titleId} className="type-section text-balance-th text-fg">
          {thaiLabel(title)}
        </h3>
        <p id={descriptionId} className="-mt-1.5 text-base text-fg-muted">
          {thaiCopy(description)}
        </p>
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" size="lg" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
