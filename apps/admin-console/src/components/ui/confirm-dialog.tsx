"use client";

import { ConfirmDialog as AppConfirmDialog } from "@/components/app/ConfirmDialog";

/**
 * @deprecated Legacy API kept for unmigrated pages. Use `ConfirmDialog`
 * from "@/components/app" (tone, requireText, reason, details).
 *
 * Behaviour kept: the dialog closes after `onConfirm` settles, even when it
 * throws (old pages show their own toast).
 */
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  icon?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AppConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone={variant === "destructive" ? "danger" : "brand"}
      onConfirm={async () => {
        try {
          await onConfirm();
        } catch {
          // legacy pages report their own errors
        }
      }}
    />
  );
}
