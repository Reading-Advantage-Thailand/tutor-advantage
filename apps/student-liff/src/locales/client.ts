"use client"

type Params = Record<string, string | number>

const humanizeKey = (key: string) =>
  key
    .split(".")
    .at(-1)
    ?.replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || key

export function useScopedI18n(scope?: string) {
  return (key: string, params?: Params) => {
    const value = humanizeKey(key || scope || "Game")
    if (!params) return value
    return Object.entries(params).reduce(
      (text, [name, param]) => text.replaceAll(`{${name}}`, String(param)),
      value
    )
  }
}

export function useCurrentLocale() {
  return "en"
}
