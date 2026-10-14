"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sheet title (also the dialog's accessible name). */
  title: ReactNode;
  description?: ReactNode;
  /** Scrollable body (overscroll contained). */
  children?: ReactNode;
  /** Pinned action area under the body (safe-area aware), e.g. buttons. */
  footer?: ReactNode;
  /** Show the round × button (default true). */
  showClose?: boolean;
  /** Allow closing via backdrop, Escape, swipe and × (default true). */
  dismissible?: boolean;
  /** Called after the close animation finishes (reset form state here). */
  onClosed?: () => void;
  /** Extra classes for the sheet panel. */
  className?: string;
  /** Extra classes for the scrollable body (default padding 20px). */
  bodyClassName?: string;
}

const BottomSheetImpl = dynamic(() => import("./BottomSheetImpl").then((m) => m.BottomSheetImpl), {
  ssr: false,
});

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Native-style bottom sheet: slide-up, drag handle, swipe-down to close,
 * focus trap, Escape/backdrop close, scroll lock, max-height 90dvh, safe-area
 * padding, centred on the app column. Built on @base-ui/react Drawer.
 *
 * The drawer code is fetched when the browser is idle after the page mounts
 * (or immediately on first open), so it never weighs on initial page load.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <BottomSheet open={open} onOpenChange={setOpen} title="เลือกคลาส"
 *   footer={<Button variant="brand" size="cta" className="w-full">ยืนยัน</Button>}>
 *   …
 * </BottomSheet>
 */
export function BottomSheet(props: BottomSheetProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (armed) return;
    const win = window as IdleWindow;
    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(() => setArmed(true), { timeout: 2500 });
      return () => win.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setArmed(true), 800);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (!armed && !props.open) return null;
  return <BottomSheetImpl {...props} />;
}

export interface ConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Label of the main action, e.g. "ออกจากระบบ". */
  confirmLabel: string;
  /** Defaults to t("common.cancel"). */
  cancelLabel?: string;
  /** danger (red, destructive) or brand (green, default). */
  tone?: "danger" | "brand";
  /** Called on confirm; close the sheet yourself when the work is done. */
  onConfirm: () => void;
  /** Shows a spinner on confirm and blocks dismissing. */
  loading?: boolean;
  /** Optional extra content between the description and the buttons. */
  children?: ReactNode;
}

/** Two-button confirmation sheet (confirm on top, cancel below). */
export function ConfirmSheet({
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
}: ConfirmSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      showClose={false}
      dismissible={!loading}
      bodyClassName={children ? undefined : "hidden"}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            variant={tone === "danger" ? "danger" : "brand"}
            size="cta"
            className="w-full"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            variant="ghost"
            size="touch"
            className="w-full text-fg-muted"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? t("common.cancel")}
          </Button>
        </div>
      }
    >
      {children}
    </BottomSheet>
  );
}
