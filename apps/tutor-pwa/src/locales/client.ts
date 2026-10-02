"use client"

import { translateGameLabel, type GameLabelParams } from "@/lib/games/gameLabels"

// Game components (shared with apps/student-liff) call useScopedI18n with game
// scopes such as "pages.student.gamesPage.castleDefense". Labels resolve from
// the Thai game dictionary in lib/games/gameLabels.ts and fall back to a
// readable English label built from the key.

export function useScopedI18n(scope?: string) {
  return (key: string, params?: GameLabelParams) => translateGameLabel(scope, key, params)
}

export function useI18n() {
  return (key: string, params?: GameLabelParams) => translateGameLabel(undefined, key, params)
}

export function useCurrentLocale() {
  return "th"
}
