/**
 * User-role labels, split out of lib/status.ts so the admin shell (sidebar /
 * nav drawer) can label the signed-in role without shipping every status map
 * in the root layout. `ADMIN_STATUS.userRole` is this same table.
 */
import type { StatusMeta } from "./status";

export const USER_ROLE_STATUS = {
  ADMIN: { label: "ผู้ดูแลระบบ", tone: "brand" },
  FINANCE_CHECKER: { label: "ผู้ตรวจสอบการเงิน", tone: "info" },
  FINANCE_MAKER: { label: "ผู้จัดทำการเงิน", tone: "info" },
  TUTOR: { label: "ครู", tone: "neutral" },
  STUDENT: { label: "นักเรียน", tone: "neutral" },
  GUARDIAN: { label: "ผู้ปกครอง", tone: "neutral" },
} as const satisfies Record<string, StatusMeta>;

export function humanizeStatus(value: string): string {
  const text = value.replace(/[_-]+/g, " ").toLowerCase().trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "–";
}

/** Same as `statusLabel("userRole", role)`. */
export function roleLabel(role: string | null | undefined): string {
  const key = (role ?? "").toUpperCase();
  const meta = (USER_ROLE_STATUS as Record<string, StatusMeta>)[key];
  return meta ? meta.label : key ? humanizeStatus(key) : "–";
}
