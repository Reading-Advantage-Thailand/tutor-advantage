"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { Sheet } from "./Sheet";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger = red destructive action; brand = green (default). */
  tone?: "brand" | "danger";
  onConfirm: () => void;
  /** Spinner on confirm + blocks dismissing. */
  loading?: boolean;
  children?: ReactNode;
}

/** Two-button confirmation (sheet on phones, dialog on desktop). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "brand",
  onConfirm,
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      showClose={false}
      dismissible={!loading}
      width={440}
      bodyClassName={children ? undefined : "hidden"}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" size="lg" className="md:h-9 md:px-3.5" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t("shell.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "default"}
            size="lg"
            className="md:h-9 md:px-3.5"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Sheet>
  );
}
