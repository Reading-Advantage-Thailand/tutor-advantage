/**
 * Thai UI dictionary + typed `t()` lookup.
 *
 * Each top-level namespace lives in its own file under `src/locales/th/<namespace>.ts`
 * so feature groups can add strings without editing the same file:
 * - add keys to the namespace file your feature owns (append-only),
 * - create a new namespace file + register it below only if no existing one fits.
 * `t("namespace.key")` stays fully typed; unknown keys are a compile error.
 */
import { app } from "@/locales/th/app";
import { interactivePlay } from "@/locales/th/interactivePlay";
import { verification } from "@/locales/th/verification";
import { tutorClass } from "@/locales/th/tutorClass";
import { dashboardSchedule } from "@/locales/th/dashboardSchedule";
import { dashboardSettings } from "@/locales/th/dashboardSettings";
import { dashboardPerformance } from "@/locales/th/dashboardPerformance";
import { dashboardNetwork } from "@/locales/th/dashboardNetwork";
import { dashboardHome } from "@/locales/th/dashboardHome";
import { dashboardChat } from "@/locales/th/dashboardChat";
import { dashboardEarnings } from "@/locales/th/dashboardEarnings";
import { demo } from "@/locales/th/demo";
import { lesson } from "@/locales/th/lesson";
import { shell } from "@/locales/th/shell";

export { tutorLegalCopy } from "@/locales/th/legal";

export const th = {
  app,
  interactivePlay,
  verification,
  tutorClass,
  dashboardSchedule,
  dashboardSettings,
  dashboardPerformance,
  dashboardNetwork,
  dashboardHome,
  dashboardChat,
  dashboardEarnings,
  demo,
  lesson,
  shell,
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

export function t(key: I18nKey): string {
  return key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, th) as string;
}
