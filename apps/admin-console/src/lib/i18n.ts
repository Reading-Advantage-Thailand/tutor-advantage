/**
 * Thai UI dictionary + typed `t()` lookup for the admin console.
 *
 * Each top-level namespace lives in its own file under `src/locales/th/<ns>.ts`
 * so page groups can add strings without editing the same file:
 * - add keys to the namespace file your group owns (append-only),
 * - need a new namespace? create the file (ending with `registerMessages(...)`)
 *   and add it to `Messages` below.
 * `t("namespace.key")` stays fully typed; unknown keys are a compile error.
 * `t("shell.pageOf", { page: 1, pages: 3 })` fills `{placeholders}`.
 *
 * Bundle size: only the shared `shell` + `api` namespaces ship with the root
 * layout. Every other namespace is loaded by the route that uses it: a file
 * that uses `t("users.…")` (or holds a "users.…" key) must also
 * `import "@/locales/th/users";` — that side-effect import registers the
 * strings. `i18nRegistration.test.ts` enforces this.
 */
import { api } from "../locales/th/api";
import { shell } from "../locales/th/shell";
import type { adjustments } from "../locales/th/adjustments";
import type { audit } from "../locales/th/audit";
import type { confirm } from "../locales/th/confirm";
import type { coupons } from "../locales/th/coupons";
import type { dashboard } from "../locales/th/dashboard";
import type { dev } from "../locales/th/dev";
import type { docs } from "../locales/th/docs";
import type { fraud } from "../locales/th/fraud";
import type { layout } from "../locales/th/layout";
import type { login } from "../locales/th/login";
import type { operations } from "../locales/th/operations";
import type { reconciliation } from "../locales/th/reconciliation";
import type { roles } from "../locales/th/roles";
import type { settlements } from "../locales/th/settlements";
import type { unauthorized } from "../locales/th/unauthorized";
import type { userDetail } from "../locales/th/userDetail";
import type { userHeader } from "../locales/th/userHeader";
import type { users } from "../locales/th/users";
import type { voice } from "../locales/th/voice";

export interface Messages {
  api: typeof api;
  shell: typeof shell;
  adjustments: typeof adjustments;
  audit: typeof audit;
  confirm: typeof confirm;
  coupons: typeof coupons;
  dashboard: typeof dashboard;
  dev: typeof dev;
  docs: typeof docs;
  fraud: typeof fraud;
  layout: typeof layout;
  login: typeof login;
  operations: typeof operations;
  reconciliation: typeof reconciliation;
  roles: typeof roles;
  settlements: typeof settlements;
  unauthorized: typeof unauthorized;
  userDetail: typeof userDetail;
  userHeader: typeof userHeader;
  users: typeof users;
  voice: typeof voice;
}

export type Namespace = keyof Messages;

/** Namespaces available at runtime (core + whatever the current route imported). */
const loaded: { [N in Namespace]?: Messages[N] } = { api, shell };

/** Called by each route-level locale module (`src/locales/th/<ns>.ts`) when it is imported. */
export function registerMessages<N extends Namespace>(namespace: N, messages: Messages[N]): void {
  loaded[namespace] = messages as (typeof loaded)[N];
}

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
  }, loaded);
  if (value === undefined && process.env.NODE_ENV !== "production") {
    const namespace = key.split(".")[0] as Namespace;
    if (!loaded[namespace]) console.error(`[i18n] "${key}": namespace "${namespace}" not loaded — add import "@/locales/th/${namespace}"`);
  }
  const text = typeof value === "string" ? value : key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
