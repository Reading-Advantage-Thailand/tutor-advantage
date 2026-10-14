"use client";

import dynamic from "next/dynamic";
import type { ConfirmDialogProps } from "./ConfirmDialogImpl";
import { useIdleArmed } from "./useIdleArmed";

export type { ConfirmDialogProps, ConfirmReasonOptions } from "./ConfirmDialogImpl";

const ConfirmDialogImpl = dynamic(() => import("./ConfirmDialogImpl").then((m) => m.ConfirmDialogImpl), { ssr: false });

/**
 * Confirmation for every money / identity / role / destructive action.
 * Bottom sheet on phones, dialog on desktop. Optional type-to-confirm and
 * required reason. Copy should state amounts and counts ("โอนเงิน 12 รายการ
 * รวม ฿45,000"), never just "ยืนยัน?". See ConfirmDialogImpl for the props.
 *
 * Only shown after a click, so its code (form fields, sheet) loads when the
 * browser is idle (or on first open) instead of with the page.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const armed = useIdleArmed();
  if (!armed && !props.open) return null;
  return <ConfirmDialogImpl {...props} />;
}
