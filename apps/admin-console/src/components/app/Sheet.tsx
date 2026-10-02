"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useIdleArmed } from "./useIdleArmed";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title (also the dialog's accessible name). */
  title: ReactNode;
  description?: ReactNode;
  /** Scrollable body. */
  children?: ReactNode;
  /** Pinned action area (safe-area aware), e.g. buttons. */
  footer?: ReactNode;
  /** Show the × button (default true). */
  showClose?: boolean;
  /** Allow closing via backdrop, Escape, swipe and × (default true). */
  dismissible?: boolean;
  /** Called after the close animation (reset form state here). */
  onClosed?: () => void;
  /** Dialog width on ≥768px in px (default 520). */
  width?: number;
  className?: string;
  bodyClassName?: string;
}

const SheetImpl = dynamic(() => import("./SheetImpl").then((m) => m.SheetImpl), { ssr: false });

/**
 * Responsive modal: bottom sheet on phones, centred dialog on tablet/desktop.
 * Focus trap, Escape/backdrop close, scroll lock, swipe-down (phones).
 * The drawer code loads when the browser is idle (or on first open).
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <Sheet open={open} onOpenChange={setOpen} title="เลื่อนคลาส"
 *   footer={<Button className="w-full md:w-auto">บันทึก</Button>}>…</Sheet>
 */
export function Sheet(props: SheetProps) {
  const armed = useIdleArmed();
  if (!armed && !props.open) return null;
  return <SheetImpl {...props} />;
}

/** Alias kept for parity with the student app. */
export const BottomSheet = Sheet;
