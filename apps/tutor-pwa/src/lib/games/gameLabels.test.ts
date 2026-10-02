import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { GAME_COMMON_TH, GAME_LABELS_TH, humanizeGameKey, interpolateGameLabel, translateGameLabel } from "./gameLabels"

const THAI = /[฀-๿]/

describe("translateGameLabel", () => {
  it("returns Thai for scoped game keys", () => {
    const scope = "pages.student.gamesPage.castleDefense"
    expect(translateGameLabel(scope, "hud.score")).toBe("คะแนน")
    expect(translateGameLabel(scope, "hud.castleHp")).toBe("พลังปราสาท")
    expect(translateGameLabel(scope, "controls.build")).toBe("สร้าง")
    expect(translateGameLabel("pages.student.gamesPage.enchantedLibrary", "hud.mana")).toBe("มานา")
    expect(translateGameLabel("pages.student.gamesPage.enchantedLibrary", "hud.shields")).toBe("โล่")
  })

  it("interpolates {params}", () => {
    expect(
      translateGameLabel("pages.student.gamesPage.castleDefense", "hud.wave", { current: 2, killed: 3, total: 8 }),
    ).toBe("ด่าน 2 · ศัตรู 3/8")
    expect(interpolateGameLabel("{a} + {a} = {b}", { a: 1, b: "2" })).toBe("1 + 1 = 2")
    expect(interpolateGameLabel("ด่าน {current}", {})).toBe("ด่าน {current}")
  })

  it("uses generic HUD words for games without a specific entry", () => {
    expect(translateGameLabel("pages.student.gamesPage.someNewGame", "hud.score")).toBe("คะแนน")
    expect(translateGameLabel("pages.student.gamesPage.someNewGame", "hud.time")).toBe("เวลา")
    expect(translateGameLabel("pages.student.gamesPage.someNewGame", "hud.wave", { current: 4 })).toBe("ด่าน 4")
  })

  it("falls back to a readable English label for unknown keys", () => {
    expect(translateGameLabel("pages.student.gamesPage.castleDefense", "hud.unknownThing")).toBe("Unknown Thing")
    expect(translateGameLabel("x", "messages.big_win", { n: 1 })).toBe("Big Win")
    expect(translateGameLabel(undefined, "")).toBe("Game")
    expect(translateGameLabel("x", "toString")).toBe("To String")
    expect(humanizeGameKey("controls.collectKeys")).toBe("Collect Keys")
  })

  it("resolves ranking dialog namespaces and difficulties", () => {
    const scope = "pages.student.gamesPage"
    expect(translateGameLabel(scope, "castleDefense.ranking.leaderboard")).toBe("ตารางอันดับ")
    expect(translateGameLabel(scope, "dragonRider.difficulty.medium")).toBe("ปานกลาง")
    expect(translateGameLabel(scope, "dragonFlight.difficulty.extreme")).toBe("สุดโหด")
  })

  it("every dictionary entry is Thai or keeps its placeholders", () => {
    for (const value of [...Object.values(GAME_LABELS_TH), ...Object.values(GAME_COMMON_TH)]) {
      expect(value.trim().length).toBeGreaterThan(0)
      if (value !== "XP") expect(value).toMatch(THAI)
    }
  })
})

/** Every static t("...") key used by the shared game components has a Thai label. */
describe("game components label coverage", () => {
  const gamesDir = fileURLToPath(new URL("../../components/games", import.meta.url))
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path)
    }
  }
  walk(gamesDir)

  const usages: { file: string; scope: string; key: string }[] = []
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const decl of source.matchAll(/const\s+(\w+)\s*=\s*useScopedI18n\(\s*["']([^"']+)["']\s*\)/g)) {
      const [, name, scope] = decl
      const call = new RegExp(`\\b${name}\\(\\s*["']([^"'$]+)["']`, "g")
      for (const match of source.matchAll(call)) usages.push({ file, scope, key: match[1] })
    }
  }

  it("finds the game label usages", () => {
    expect(usages.length).toBeGreaterThan(100)
  })

  it("has a Thai label for each one", () => {
    const missing = usages
      .filter(({ scope, key }) => !THAI.test(translateGameLabel(scope, key, {})) && translateGameLabel(scope, key) !== "XP")
      .map(({ file, scope, key }) => `${file.slice(gamesDir.length + 1)}: ${scope}.${key}`)
    expect(missing).toEqual([])
  })
})
