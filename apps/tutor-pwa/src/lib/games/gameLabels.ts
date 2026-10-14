// Thai labels for the arcade games shared by apps/student-liff and
// apps/tutor-pwa (keep this file identical in both apps).
//
// Game components call useScopedI18n("<scope>") and then t("<key>", params).
// Lookup order:
//   1. GAME_LABELS_TH["<scope>.<key>"]  - game-specific wording
//   2. GAME_COMMON_TH["<key>"]          - generic HUD words any game may use
//   3. a readable English label from the key ("hud.castleHp" -> "Castle Hp")
// {param} placeholders are interpolated in every case.
//
// Players are Thai children, so keep labels short and friendly; HUD chips are
// small (some are 8px uppercase), so prefer one or two words there.

export type GameLabelParams = Record<string, string | number>

const GAMES = "pages.student.gamesPage"

const difficultyLabels = {
  easy: "ง่าย",
  normal: "ปกติ",
  medium: "ปานกลาง",
  hard: "ยาก",
  extreme: "สุดโหด",
}

/** RankingDialog renders `${namespace}.ranking.*` and `${namespace}.difficulty.*`. */
const rankingLabels = (namespace: string): Record<string, string> => ({
  [`${GAMES}.${namespace}.ranking.leaderboard`]: "ตารางอันดับ",
  [`${GAMES}.${namespace}.ranking.noChampions`]: "ยังไม่มีแชมป์",
  [`${GAMES}.${namespace}.ranking.beTheFirst`]: "มาเป็นคนแรกกันเลย!",
  [`${GAMES}.${namespace}.ranking.dragonRider`]: "ผู้เล่น",
  ...Object.fromEntries(
    Object.entries(difficultyLabels).map(([level, label]) => [`${GAMES}.${namespace}.difficulty.${level}`, label]),
  ),
})

/** Generic keys, matched on the key alone when no game-specific entry exists. */
export const GAME_COMMON_TH: Record<string, string> = {
  score: "คะแนน",
  round: "รอบ",
  loading: "กำลังโหลด...",
  startButton: "เริ่มเล่น",
  "hud.score": "คะแนน",
  "hud.time": "เวลา",
  "hud.progress": "ความคืบหน้า",
  "hud.wave": "ด่าน {current}",
  "hud.mana": "มานา",
  "hud.shields": "โล่",
  "hud.lives": "ชีวิต",
  "hud.level": "ด่าน",
  "hud.translation": "คำแปล",
  "hud.size": "ขนาด",
  "controls.move": "เดิน",
  "controls.moveKeys": "WASD / ลูกศร",
  "messages.victory": "ชนะแล้ว!",
  "messages.defeat": "แพ้แล้ว",
  "messages.victoryDesc": "เก่งมาก!",
  "messages.defeatDesc": "ไม่เป็นไร ลองใหม่อีกครั้งนะ",
}

export const GAME_LABELS_TH: Record<string, string> = {
  // Shared screens (StartScreen, ResultsScreen, rpg-battle, dragon-flight, wizard-vs-zombie)
  [`${GAMES}.common.accuracy`]: "ความแม่นยำ",
  [`${GAMES}.common.defeat`]: "แพ้แล้ว",
  [`${GAMES}.common.gameOver`]: "จบเกม",
  [`${GAMES}.common.howToPlay`]: "วิธีเล่น",
  [`${GAMES}.common.playAgain`]: "เล่นอีกครั้ง",
  [`${GAMES}.common.ready`]: "พร้อมแล้ว",
  [`${GAMES}.common.score`]: "คะแนน",
  [`${GAMES}.common.startBattle`]: "เริ่มต่อสู้",
  [`${GAMES}.common.startSurvival`]: "เริ่มเอาตัวรอด",
  [`${GAMES}.common.tip`]: "เคล็ดลับ",
  [`${GAMES}.common.tryAgain`]: "ลองอีกครั้ง",
  [`${GAMES}.common.victory`]: "ชนะแล้ว!",
  [`${GAMES}.common.viewLeaderboard`]: "ดูอันดับ",
  [`${GAMES}.common.wordsToReview`]: "คำที่ควรทบทวน",
  [`${GAMES}.common.xp`]: "XP",
  [`${GAMES}.common.xpEarned`]: "XP ที่ได้",

  [`${GAMES}.magicDefense.defenseBriefing`]: "เตรียมป้องกัน",
  [`${GAMES}.magicDefense.difficulty.easy`]: difficultyLabels.easy,
  [`${GAMES}.magicDefense.difficulty.normal`]: difficultyLabels.normal,
  [`${GAMES}.magicDefense.difficulty.hard`]: difficultyLabels.hard,
  [`${GAMES}.magicDefense.difficulty.extreme`]: difficultyLabels.extreme,
  [`${GAMES}.magicDefense.leaderboard`]: "ตารางอันดับ",
  [`${GAMES}.magicDefense.noVocabularyLoaded`]: "ยังไม่มีคำศัพท์",
  [`${GAMES}.magicDefense.reviewSpells`]: "ทบทวนคาถาก่อนเริ่ม",
  [`${GAMES}.magicDefense.siegeDescription`]: "ศัตรูกำลังบุก! ตอบคำศัพท์ให้ถูกเพื่อร่ายเวทป้องกัน",
  [`${GAMES}.magicDefense.spellBook`]: "สมุดคาถา",
  [`${GAMES}.magicDefense.startDefense`]: "เริ่มป้องกัน",
  [`${GAMES}.magicDefense.theSiegeBegins`]: "ศัตรูบุกแล้ว!",

  [`${GAMES}.rpgBattle.battleDescription`]: "ตอบคำศัพท์ให้ถูกเพื่อโจมตีศัตรู",
  [`${GAMES}.rpgBattle.battlePreparation`]: "เตรียมต่อสู้",
  [`${GAMES}.rpgBattle.instructions.step1Title`]: "ดูคำศัพท์",
  [`${GAMES}.rpgBattle.instructions.step1Desc`]: "อ่านคำที่ศัตรูถือมา",
  [`${GAMES}.rpgBattle.instructions.step2Title`]: "เลือกคำตอบ",
  [`${GAMES}.rpgBattle.instructions.step2Desc`]: "เลือกคำแปลที่ถูกต้อง",
  [`${GAMES}.rpgBattle.instructions.step3Title`]: "โจมตี!",
  [`${GAMES}.rpgBattle.instructions.step3Desc`]: "ตอบถูกได้โจมตี ตอบผิดโดนโจมตีกลับ",
  [`${GAMES}.rpgBattle.instructions.tip`]: "ตอบถูกติดกันจะได้คอมโบ",
  [`${GAMES}.rpgBattle.loadingRankings`]: "กำลังโหลดอันดับ...",
  [`${GAMES}.rpgBattle.noRankings`]: "ยังไม่มีอันดับ",
  [`${GAMES}.rpgBattle.noVocabulary`]: "ยังไม่มีคำศัพท์",
  [`${GAMES}.rpgBattle.reviewSpells`]: "ทบทวนคาถาก่อนเริ่ม",
  [`${GAMES}.rpgBattle.spellBook`]: "สมุดคาถา",
  [`${GAMES}.rpgBattle.spells`]: "คาถา",
  [`${GAMES}.rpgBattle.tabs.briefing`]: "ภารกิจ",
  [`${GAMES}.rpgBattle.tabs.rankings`]: "อันดับ",
  [`${GAMES}.rpgBattle.tabs.vocabulary`]: "คำศัพท์",
  [`${GAMES}.rpgBattle.theBattleAwaits`]: "การต่อสู้รออยู่!",
  [`${GAMES}.rpgBattle.topWarriors`]: "นักรบอันดับต้น",

  // Dragon Flight
  [`${GAMES}.dragonFlight.accuracy`]: "ความแม่นยำ",
  [`${GAMES}.dragonFlight.briefingDesc`]: "ดูคำศัพท์ แล้วเลือกระดับความยาก",
  [`${GAMES}.dragonFlight.correct`]: "ตอบถูก",
  [`${GAMES}.dragonFlight.defeat`]: "มังกรตกแล้ว!",
  [`${GAMES}.dragonFlight.defeatDesc`]: "ไม่เป็นไร ลองบินใหม่อีกครั้งนะ",
  [`${GAMES}.dragonFlight.difficulty.easyDesc`]: "บินช้า มีเวลาคิดเยอะ",
  [`${GAMES}.dragonFlight.difficulty.normalDesc`]: "ความเร็วกำลังดี",
  [`${GAMES}.dragonFlight.difficulty.hardDesc`]: "บินเร็ว ต้องตอบไว",
  [`${GAMES}.dragonFlight.difficulty.extremeDesc`]: "ตอบผิดครั้งเดียวจบเกม!",
  [`${GAMES}.dragonFlight.difficultyLabel`]: "ระดับ",
  [`${GAMES}.dragonFlight.dragons`]: "มังกร",
  [`${GAMES}.dragonFlight.flightBriefing`]: "เตรียมบิน",
  [`${GAMES}.dragonFlight.gateRunBegins`]: "บินผ่านประตูกันเลย!",
  [`${GAMES}.dragonFlight.gateRunDesc`]: "บินผ่านประตูที่มีคำแปลถูกต้อง",
  [`${GAMES}.dragonFlight.loading`]: "กำลังโหลด...",
  [`${GAMES}.dragonFlight.moreWords`]: "คำ",
  [`${GAMES}.dragonFlight.noVocabularyLoaded`]: "ยังไม่มีคำศัพท์",
  [`${GAMES}.dragonFlight.playAgain`]: "เล่นอีกครั้ง",
  [`${GAMES}.dragonFlight.prompt`]: "หาคำแปล",
  [`${GAMES}.dragonFlight.start`]: "เริ่มบิน",
  [`${GAMES}.dragonFlight.summoning`]: "กำลังเรียกมังกร...",
  [`${GAMES}.dragonFlight.time`]: "เวลา",
  [`${GAMES}.dragonFlight.victory`]: "บินสำเร็จ!",
  [`${GAMES}.dragonFlight.victoryDesc`]: "เก่งมาก! ผ่านทุกประตูแล้ว",
  [`${GAMES}.dragonFlight.vocabularyPreview`]: "คำศัพท์ในเกม",
  [`${GAMES}.dragonFlight.xpEarned`]: "XP ที่ได้",
  ...rankingLabels("dragonFlight"),

  // Dragon Rider
  [`${GAMES}.dragonRider.startScreen.title`]: "นักขี่มังกร",
  [`${GAMES}.dragonRider.startScreen.description`]: "บินผ่านประตูคำศัพท์ แล้วสู้กับบอส!",
  [`${GAMES}.dragonRider.startScreen.loading`]: "กำลังโหลด...",
  [`${GAMES}.dragonRider.startScreen.startButton`]: "เริ่มบิน",
  [`${GAMES}.dragonRider.startScreen.rankingButton`]: "อันดับ",
  [`${GAMES}.dragonRider.startScreen.difficultyEasy`]: difficultyLabels.easy,
  [`${GAMES}.dragonRider.startScreen.difficultyMedium`]: difficultyLabels.medium,
  [`${GAMES}.dragonRider.startScreen.difficultyHard`]: difficultyLabels.hard,
  [`${GAMES}.dragonRider.instructionsScreen.gameplay.gatesDesc`]: "บินผ่านประตูที่มีคำแปลถูกต้อง",
  [`${GAMES}.dragonRider.instructionsScreen.gameplay.bossDesc`]: "ตอบถูกเพื่อโจมตีบอส",
  [`${GAMES}.dragonRider.instructionsScreen.gameplay.objectiveDesc`]: "เก็บคำให้ได้มากที่สุดก่อนเจอบอส",
  [`${GAMES}.dragonRider.instructionsScreen.controls.move`]: "บิน",
  [`${GAMES}.dragonRider.instructionsScreen.controls.moveKeys`]: "WASD / ลูกศร / ลากนิ้ว",
  [`${GAMES}.dragonRider.resultsScreen.wordsCollected`]: "คำที่เก็บได้",
  [`${GAMES}.dragonRider.gameplayScreen.hud.bossHealth`]: "พลังบอส",
  ...rankingLabels("dragonRider"),

  // Castle Defense
  [`${GAMES}.castleDefense.title`]: "ป้องกันปราสาท",
  [`${GAMES}.castleDefense.subtitle`]: "เรียงคำเป็นประโยค แล้วสร้างป้อมปกป้องปราสาท",
  [`${GAMES}.castleDefense.instructions.step1`]: "เดินเก็บคำตามลำดับของประโยค",
  [`${GAMES}.castleDefense.instructions.step2`]: "ครบประโยคแล้ว ไปที่จุดสร้างแล้วกด “สร้าง”",
  [`${GAMES}.castleDefense.instructions.step3`]: "ป้อมจะยิงศัตรู อย่าให้ศัตรูถึงปราสาท",
  [`${GAMES}.castleDefense.proTip`]: "เก็บคำให้ถูกลำดับ จะสร้างป้อมได้เร็วขึ้น",
  [`${GAMES}.castleDefense.startButton`]: "เริ่มป้องกัน",
  [`${GAMES}.castleDefense.loading`]: "กำลังโหลด...",
  [`${GAMES}.castleDefense.controls.move`]: "เดิน",
  [`${GAMES}.castleDefense.controls.moveKeys`]: "WASD / ลูกศร",
  [`${GAMES}.castleDefense.controls.build`]: "สร้าง",
  [`${GAMES}.castleDefense.controls.buildKeys`]: "Space / ปุ่มสร้าง",
  [`${GAMES}.castleDefense.controls.collect`]: "เก็บคำ",
  [`${GAMES}.castleDefense.controls.collectKeys`]: "เดินชนคำ",
  [`${GAMES}.castleDefense.hud.score`]: "คะแนน",
  [`${GAMES}.castleDefense.hud.castleHp`]: "พลังปราสาท",
  [`${GAMES}.castleDefense.hud.progress`]: "ความคืบหน้า",
  [`${GAMES}.castleDefense.hud.wave`]: "ด่าน {current} · ศัตรู {killed}/{total}",
  [`${GAMES}.castleDefense.hud.buildTower`]: "กด “สร้าง” เพื่อตั้งป้อม!",
  [`${GAMES}.castleDefense.messages.sentenceComplete`]: "ครบประโยคแล้ว!",
  [`${GAMES}.castleDefense.messages.victory`]: "ปกป้องปราสาทสำเร็จ!",
  [`${GAMES}.castleDefense.messages.victoryDesc`]: "เก่งมาก! ศัตรูถอยทัพไปแล้ว",
  [`${GAMES}.castleDefense.messages.defeat`]: "ปราสาทพังแล้ว!",
  [`${GAMES}.castleDefense.messages.defeatDesc`]: "ไม่เป็นไร ลองใหม่อีกครั้งนะ",
  [`${GAMES}.castleDefense.messages.wavesCleared`]: "ด่านที่ผ่าน",
  [`${GAMES}.castleDefense.messages.enemiesDefeated`]: "ศัตรูที่ปราบได้",
  ...rankingLabels("castleDefense"),

  // Enchanted Library
  [`${GAMES}.enchantedLibrary.title`]: "ห้องสมุดเวทมนตร์",
  [`${GAMES}.enchantedLibrary.subtitle`]: "เก็บหนังสือคำแปลที่ถูก หลบวิญญาณ",
  [`${GAMES}.enchantedLibrary.instructions.step1`]: "ดูคำศัพท์ด้านบน",
  [`${GAMES}.enchantedLibrary.instructions.step2`]: "เดินไปเก็บหนังสือที่มีคำแปลถูกต้อง",
  [`${GAMES}.enchantedLibrary.instructions.step3`]: "เปิดโล่กันวิญญาณที่ลอยมา",
  [`${GAMES}.enchantedLibrary.instructions.step4`]: "ตอบถูกได้มานาและโล่เพิ่ม",
  [`${GAMES}.enchantedLibrary.proTip`]: "เก็บโล่ไว้ใช้ตอนวิญญาณเข้าใกล้",
  [`${GAMES}.enchantedLibrary.startButton`]: "เข้าห้องสมุด",
  [`${GAMES}.enchantedLibrary.controls.move`]: "เดิน",
  [`${GAMES}.enchantedLibrary.controls.moveKeys`]: "WASD / ลูกศร",
  [`${GAMES}.enchantedLibrary.controls.shield`]: "โล่",
  [`${GAMES}.enchantedLibrary.controls.shieldKeys`]: "Space / ปุ่มโล่",
  [`${GAMES}.enchantedLibrary.difficulty.label`]: "ระดับ",
  [`${GAMES}.enchantedLibrary.loading`]: "กำลังเปิดห้องสมุด...",
  [`${GAMES}.enchantedLibrary.hud.find`]: "หาคำแปล",
  [`${GAMES}.enchantedLibrary.hud.mana`]: "มานา",
  [`${GAMES}.enchantedLibrary.hud.time`]: "เวลา",
  [`${GAMES}.enchantedLibrary.hud.shields`]: "โล่",
  [`${GAMES}.enchantedLibrary.messages.victory`]: "จบภารกิจห้องสมุด!",
  [`${GAMES}.enchantedLibrary.messages.victoryDesc`]: "เก่งมาก! เก็บหนังสือได้เยอะเลย",
  [`${GAMES}.enchantedLibrary.messages.wordsMastered`]: "คำที่จำได้แล้ว",
  [`${GAMES}.enchantedLibrary.messages.correctBooks`]: "หนังสือที่ถูก",

  // Potion Rush
  [`${GAMES}.potionRush.title`]: "ร้านยาวิเศษ",
  [`${GAMES}.potionRush.gameSubtitle`]: "เรียงคำเป็นประโยค เพื่อปรุงยาให้ลูกค้า",
  [`${GAMES}.potionRush.instructions.step1`]: "ดูประโยคที่ลูกค้าอยากได้",
  [`${GAMES}.potionRush.instructions.step2`]: "ลากคำจากสายพานใส่หม้อตามลำดับ",
  [`${GAMES}.potionRush.instructions.step3`]: "คำที่ไม่ใช้ ทิ้งลงถังขยะ",
  [`${GAMES}.potionRush.proTip`]: "วางคำไว้ในช่อง HOLD ก่อนได้",
  [`${GAMES}.potionRush.startButton`]: "เปิดร้าน",
  [`${GAMES}.potionRush.controls.match`]: "เรียงคำ",
  [`${GAMES}.potionRush.controls.matchKeys`]: "ใส่หม้อตามลำดับ",
  [`${GAMES}.potionRush.controls.drag`]: "ลาก",
  [`${GAMES}.potionRush.controls.dragKeys`]: "แตะค้างแล้วลาก",
  [`${GAMES}.potionRush.hud.score`]: "คะแนน",
  [`${GAMES}.potionRush.hud.reputation`]: "ชื่อเสียง",
  [`${GAMES}.potionRush.hud.served`]: "เสิร์ฟแล้ว",
  [`${GAMES}.potionRush.howToPlay.title`]: "วิธีเล่น",
  [`${GAMES}.potionRush.howToPlay.drag`]: "ลากคำใส่หม้อที่ตรงกัน",
  [`${GAMES}.potionRush.howToPlay.hold`]: "ช่อง HOLD เก็บคำไว้ใช้ทีหลัง",
  [`${GAMES}.potionRush.howToPlay.trash`]: "คำผิด ทิ้งลงถังขยะ",
  [`${GAMES}.potionRush.messages.customersServed`]: "ลูกค้าที่เสิร์ฟแล้ว",
  [`${GAMES}.potionRush.messages.victory`]: "หมดเวลา เก่งมาก!",
  [`${GAMES}.potionRush.messages.victoryDesc`]: "วันนี้ปรุงยาได้เยอะเลย",
  [`${GAMES}.potionRush.messages.defeat`]: "ร้านต้องปิดแล้ว!",
  [`${GAMES}.potionRush.messages.defeatDesc`]: "ชื่อเสียงหมดแล้ว ลองใหม่นะ",
  [`${GAMES}.potionRush.messages.openAgain`]: "เปิดร้านอีกครั้ง",

  // Devourer Slime
  [`${GAMES}.devourerSlime.hud.translation`]: "คำแปล",
  [`${GAMES}.devourerSlime.hud.score`]: "คะแนน",
  [`${GAMES}.devourerSlime.hud.size`]: "ขนาด",

  // Alchemist's Synthesis
  "games.alchemistsSynthesis.title": "นักปรุงยาเวทมนตร์",
  "games.alchemistsSynthesis.subtitle": "จับคู่คำกับคำแปลให้ทันเวลา",
  "games.alchemistsSynthesis.instructions.match": "จับคู่คำศัพท์กับคำแปลที่ถูกต้อง",
  "games.alchemistsSynthesis.instructions.time": "รีบจับคู่ก่อนหมดเวลา",
  "games.alchemistsSynthesis.round": "รอบ",
  "games.alchemistsSynthesis.score": "คะแนน",
}

/** Readable English fallback built from the last key segment. */
export function humanizeGameKey(key: string): string {
  return (
    key
      .split(".")
      .at(-1)
      ?.replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()) || key
  )
}

export function interpolateGameLabel(value: string, params?: GameLabelParams): string {
  if (!params) return value
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  )
}

/** Resolve a game label: Thai dictionary first, then a readable English fallback. */
export function translateGameLabel(scope: string | undefined, key: string, params?: GameLabelParams): string {
  const fullKey = scope && key ? `${scope}.${key}` : key || scope || ""
  const value =
    (Object.prototype.hasOwnProperty.call(GAME_LABELS_TH, fullKey) ? GAME_LABELS_TH[fullKey] : undefined) ??
    (key && Object.prototype.hasOwnProperty.call(GAME_COMMON_TH, key) ? GAME_COMMON_TH[key] : undefined) ??
    humanizeGameKey(key || scope || "Game")
  return interpolateGameLabel(value, params)
}
