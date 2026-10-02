"use client"

// Game components shared with apps/student-liff call useScopedI18n with
// student-app scopes (e.g. "pages.student.gamesPage.castleDefense"). Neither
// app ships a game dictionary, so mirror the student app's resolver: turn the
// key's last segment into a readable label ("hud.castleHp" -> "Castle Hp",
// "controls.build" -> "Build") instead of rendering the raw key.

type Params = Record<string, string | number>

const humanizeKey = (key: string) =>
  key
    .split(".")
    .at(-1)
    ?.replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || key

const interpolate = (value: string, params?: Params) =>
  params
    ? Object.entries(params).reduce(
        (text, [name, param]) => text.replaceAll(`{${name}}`, String(param)),
        value
      )
    : value

export function useScopedI18n(scope?: string) {
  return (key: string, params?: Params) => interpolate(humanizeKey(key || scope || "Game"), params)
}

export function useI18n() {
  return (key: string, params?: Params) => interpolate(humanizeKey(key || "Game"), params)
}

export function useCurrentLocale() {
  return "th"
}
