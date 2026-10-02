import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { GAME_TEXT_TH, tx } from "./gameText"
import { battleEnemies, battleHeroes, battleLocations } from "./rpgBattleSelection"

const THAI = /[฀-๿]/

describe("tx", () => {
  it("translates inline game UI strings to Thai", () => {
    expect(tx("Score")).toBe("คะแนน")
    expect(tx("POWER WORD")).toBe("คำพลัง")
    expect(tx("SKILLS")).toBe("สกิล")
    expect(tx("SHOCKWAVE:")).toBe("คลื่นพลัง:")
    expect(tx("Find:")).toBe("หาคำแปล:")
  })

  it("interpolates {params}", () => {
    expect(tx("MATCHES {correctAnswers}/{targetMatches}", { correctAnswers: 3, targetMatches: 10 })).toBe("จับคู่ 3/10")
    expect(tx("HP: {hp}/{maxHp}", { hp: 40, maxHp: 100 })).toBe("ชีวิต: 40/100")
  })

  it("falls back to the source text (still interpolated) for unknown strings", () => {
    expect(tx("Brand New Label")).toBe("Brand New Label")
    expect(tx("Hello {name}", { name: "Ann" })).toBe("Hello Ann")
    expect(tx("constructor")).toBe("constructor")
  })

  it("has a Thai (or key-name) value for every entry", () => {
    const keyNames = /^(XP|ZZZ|Space|Shift|Space \/ Enter)$/
    for (const [source, value] of Object.entries(GAME_TEXT_TH)) {
      expect(value.trim().length).toBeGreaterThan(0)
      if (!keyNames.test(source)) expect(`${source} -> ${value}`).toMatch(THAI)
    }
  })

  it("covers display labels that come from game config", () => {
    for (const item of [...battleHeroes, ...battleLocations, ...battleEnemies]) {
      expect(GAME_TEXT_TH[item.label], item.label).toBeDefined()
    }
  })
})

// Static check over the game components: English UI text must go through tx()
// (or the scoped game dictionary), and every tx("...") string needs an entry.
describe("game components hard-coded text", () => {
  const srcDir = fileURLToPath(new URL("../..", import.meta.url))
  const files: string[] = []
  const walk = (dir: string, filter: (name: string) => boolean) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path, filter)
      else if (filter(name)) files.push(path)
    }
  }
  walk(join(srcDir, "components/games"), (name) => /\.tsx$/.test(name) && !/\.test\./.test(name))
  walk(join(srcDir, "components/lesson"), (name) => /TeachingGame\.tsx$/.test(name))
  walk(join(srcDir, "lib/games"), (name) => /\.ts$/.test(name) && !/\.test\./.test(name))

  const UI_PROPS = new Set([
    "text", "title", "label", "placeholder", "aria-label", "alt", "gameTitle", "gameSubtitle", "startButtonText",
    "proTip", "restartButtonText", "subtitle", "description", "detail", "keys", "message", "hint", "tip", "heading",
    "buttonText", "prompt",
  ])
  const looksEnglish = (s: string) =>
    !!s && !/^[a-z]+$/.test(s) && /[A-Za-z]{2,}/.test(s) && !THAI.test(s) && !/[{};]\s*$/.test(s) && !/^(@|#|https?:|rgba?\()/.test(s)
  // Sample article content used by the tutor demos, not UI.
  const contentAllowlist = new Set(["Students read the article carefully", "The teacher asks a follow up question"])

  const untranslated: string[] = []
  const missing: string[] = []
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const where = (node: ts.Node) => `${file.slice(srcDir.length)}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
    const flag = (node: ts.Node, text: string) => {
      const value = text.replace(/\s+/g, " ").trim()
      if (looksEnglish(value) && !contentAllowlist.has(value)) untranslated.push(`${where(node)} ${JSON.stringify(value)}`)
    }
    const checkExpr = (e: ts.Expression) => {
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) flag(e, e.text)
      else if (ts.isTemplateExpression(e) && !/\bt\(/.test(e.getText()))
        flag(e, [e.head.text, ...e.templateSpans.map((span) => span.literal.text)].join(" "))
      else if (ts.isConditionalExpression(e)) {
        checkExpr(e.whenTrue)
        checkExpr(e.whenFalse)
      } else if (ts.isParenthesizedExpression(e)) checkExpr(e.expression)
    }
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ["tx", "translateText"].includes(node.expression.getText())) {
        const first = node.arguments[0]
        if (first && ts.isStringLiteral(first) && !(first.text in GAME_TEXT_TH)) missing.push(`${where(node)} ${JSON.stringify(first.text)}`)
        return
      }
      if (ts.isJsxText(node)) flag(node, node.text.replace(/&apos;/g, "'").replace(/&amp;/g, "&"))
      else if (ts.isJsxAttribute(node) && node.initializer && UI_PROPS.has(node.name.getText())) {
        const init = node.initializer
        if (ts.isStringLiteral(init)) flag(init, init.text)
        else if (ts.isJsxExpression(init) && init.expression) checkExpr(init.expression)
        return
      } else if (ts.isPropertyAssignment(node) && UI_PROPS.has(node.name.getText().replace(/['"]/g, "")) && file.endsWith(".tsx")) {
        checkExpr(node.initializer)
        return
      } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
        checkExpr(node.expression)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }

  it("scans the game sources", () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it("routes English UI text through tx()", () => {
    expect(untranslated).toEqual([])
  })

  it("has a Thai entry for every tx() string", () => {
    expect(missing).toEqual([])
  })
})
