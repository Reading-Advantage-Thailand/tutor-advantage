/**
 * Thai UI dictionary + typed `t()` lookup for the admin console.
 *
 * Each top-level namespace lives in its own file under `src/locales/th/<ns>.ts`
 * so page groups can add strings without editing the same file:
 * - add keys to the namespace file your group owns (append-only),
 * - need a new namespace? create the file and ask the lead (G0) to register it here.
 * `t("namespace.key")` stays fully typed; unknown keys are a compile error.
 * `t("shell.pageOf", { page: 1, pages: 3 })` fills `{placeholders}`.
 */
import { adjustments } from "../locales/th/adjustments";
import { api } from "../locales/th/api";
import { audit } from "../locales/th/audit";
import { confirm } from "../locales/th/confirm";
import { coupons } from "../locales/th/coupons";
import { dashboard } from "../locales/th/dashboard";
import { dev } from "../locales/th/dev";
import { docs } from "../locales/th/docs";
import { fraud } from "../locales/th/fraud";
import { layout } from "../locales/th/layout";
import { login } from "../locales/th/login";
import { operations } from "../locales/th/operations";
import { reconciliation } from "../locales/th/reconciliation";
import { roles } from "../locales/th/roles";
import { settlements } from "../locales/th/settlements";
import { shell } from "../locales/th/shell";
import { unauthorized } from "../locales/th/unauthorized";
import { userDetail } from "../locales/th/userDetail";
import { users } from "../locales/th/users";
import { voice } from "../locales/th/voice";

export { adminDocsCopy } from "../locales/th/docsCopy";

export const th = {
  api,
  layout,
  login,
  unauthorized,
  dashboard,
  operations,
  roles,
  adjustments,
  coupons,
  settlements,
  confirm,
  fraud,
  reconciliation,
  audit,
  users,
  userDetail,
  docs,
  shell,
  voice,
  dev,
} as const;

type Messages = typeof th;
type DotPrefix<TPrefix extends string, TKey extends string> = `${TPrefix}.${TKey}`;

type MessageKey<T, TPrefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? TPrefix extends ""
      ? K
      : DotPrefix<TPrefix, K>
    : MessageKey<T[K], TPrefix extends "" ? K : DotPrefix<TPrefix, K>>;
}[keyof T & string];

export type I18nKey = MessageKey<Messages>;

export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, th);
  const text = typeof value === "string" ? value : key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
