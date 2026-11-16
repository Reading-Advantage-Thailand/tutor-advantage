"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { guardFocusAfterClose, resolveFinalFocus, type FinalFocusTarget } from "./finalFocus";
import { currentOpener, trackPressedControls } from "./pressedControl";
import { useIdleArmed } from "./useIdleArmed";

export type { FinalFocusTarget } from "./finalFocus";

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
  /** Dialog width on ≥768px in px (default 520; 560 for side="right"). */
  width?: number;
  /**
   * Layout from 768px: "center" (default) is a centred dialog (forms,
   * confirmations); "right" is a full-height side sheet over the table (record
   * details, keeps the list context). Phones always get a bottom sheet.
   */
  side?: "center" | "right";
  /**
   * Where focus goes when the sheet closes and the control that opened it is
   * gone or disabled (a deleted row's "ลบ", a button disabled by the action).
   * Checked on close and again for a few seconds after, so a row that a list
   * refresh removes later still hands focus over instead of dropping it on
   * <body>. Without it, focus returns to the opener as before.
   */
  finalFocus?: FinalFocusTarget;
  className?: string;
  bodyClassName?: string;
}

const SheetImpl = dynamic(() => import("./SheetImpl").then((m) => m.SheetImpl), { ssr: false });

// Lets a sheet return focus to the button that opened it in Safari, which does
// not focus clicked buttons (see SheetImpl).
trackPressedControls();

/**
 * Responsive modal: bottom sheet on phones (top radius 16, 36×4 handle),
 * centred dialog (radius 12) or right side sheet (`side="right"`, 560) from 768px.
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
  // Focus returns to the control that opened the sheet. It is read here, when
  // the sheet opens, so it is right even when the drawer code arrives later,
  // and Base UI cannot know it for sheets that mount already open.
  const opener = useRef<HTMLElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!props.open) return;
    const element = currentOpener();
    // Reopened while still closing, with focus inside this sheet: keep the opener.
    if (element && popupRef.current?.contains(element)) return;
    opener.current = element;
  }, [props.open]);
  // finalFocus: after closing, keep focus out of <body> while the page
  // removes or disables the opener (see finalFocus.ts).
  const finalFocusRef = useRef(props.finalFocus);
  useLayoutEffect(() => {
    finalFocusRef.current = props.finalFocus;
  });
  const wasOpen = useRef(props.open);
  const stopGuard = useRef<(() => void) | null>(null);
  useEffect(() => {
    const closed = wasOpen.current && !props.open;
    wasOpen.current = props.open;
    if (props.open) {
      stopGuard.current?.();
      stopGuard.current = null;
    } else if (closed && finalFocusRef.current) {
      stopGuard.current = guardFocusAfterClose(() => resolveFinalFocus(finalFocusRef.current));
    }
  }, [props.open]);
  if (!armed && !props.open) return null;
  return <SheetImpl {...props} opener={opener} popupRef={popupRef} />;
}

/** Alias kept for parity with the student app. */
export const BottomSheet = Sheet;
