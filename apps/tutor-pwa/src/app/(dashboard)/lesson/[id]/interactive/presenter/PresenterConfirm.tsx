"use client";

/**
 * Confirmation inside the presenter. The shared ConfirmDialog is portaled to
 * <body>, which the browser hides while the presenter is in real fullscreen, so
 * a destructive dock action could never be confirmed there.
 */
import React from "react";
import { Button } from "@/components/ui/button";

export interface PresenterConfirmProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PresenterConfirm({ open, title, description, confirmLabel, cancelLabel, onConfirm, onCancel }: PresenterConfirmProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    // Start on the safe choice, so a stray Enter or Space does nothing harmful.
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-2 rounded-xl border border-hairline bg-surface p-6 shadow-popover">
        <h3 id={titleId} className="text-xl font-semibold text-fg">
          {title}
        </h3>
        <p id={descriptionId} className="text-base text-fg-muted">
          {description}
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="ghost" size="lg" onClick={onCancel}>
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
