"use client";

import { QRCodeSVG } from "qrcode.react";

/** QR image for the referral link (own chunk: loaded only when the QR sheet opens). */
export default function ReferralQr({ value }: { value: string }) {
  return <QRCodeSVG value={value} size={232} level="M" includeMargin className="h-auto w-full max-w-[232px]" />;
}
