import { Fragment, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { keepThaiWords } from "@/lib/thaiText";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Keeps the two role names on one line inside running Thai text, so
 * "ผู้ดูแลระบบ" never splits into "ผู้ดูแล" / "ระบบ" and "ผู้ตรวจสอบการเงิน"
 * never into "ผู้ตรวจ" / "สอบการเงิน". The terms are the shell's role labels;
 * the rest of the sentence goes through the shared Thai keep-together list
 * (keepThaiWords), so its other compounds stay whole too. The copy itself is
 * unchanged (presentation only). Used by /login and /unauthorized, whose text
 * boxes are wide enough for the whole role name (the shared list keeps only
 * "ผู้ตรวจสอบ", for the narrow stat labels).
 */
export function keepRoleTerms(text: string): ReactNode {
  const terms = [t("shell.roleFinanceChecker"), t("shell.roleAdmin")].filter(Boolean);
  if (terms.length === 0) return keepThaiWords(text);
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`);
  const parts = text.split(pattern);
  if (parts.length === 1) return keepThaiWords(text);
  return parts.map((part, index) =>
    terms.includes(part) ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{keepThaiWords(part)}</Fragment>
    ),
  );
}
