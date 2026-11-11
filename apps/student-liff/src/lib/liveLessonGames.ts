export type LiveLessonGameCategory = "vocabulary" | "sentence"

export interface LiveLessonGame {
  id: string
  category: LiveLessonGameCategory
  title: string
  description: string
  cover: string
  enabled?: boolean
}

export const PLAYABLE_LIVE_LESSON_GAME_IDS = new Set([
  "dragon-flight",
  "wizard-vs-zombie",
  "enchanted-library",
  "rune-match",
  "castle-defense",
  "potion-rush",
])

export const LIVE_LESSON_GAMES: LiveLessonGame[] = [
  { id: "dragon-flight", category: "vocabulary", title: "Dragon Flight", description: "สะสมพลังด้วยการเลือกความหมายของคำศัพท์ให้ถูกต้อง", cover: "/games/cover/dragon-flight-cover.webp" },
  { id: "wizard-vs-zombie", category: "vocabulary", title: "Wizard vs Zombie", description: "เคลื่อนที่ เก็บคำศัพท์ที่ถูกต้อง และเอาตัวรอดในสนามเกม", cover: "/games/cover/wizard-vs-zombie-cover.webp" },
  { id: "enchanted-library", category: "vocabulary", title: "Enchanted Library", description: "เก็บหนังสือคำศัพท์ที่ถูกต้องและหลบความหมายที่ผิด", cover: "/games/cover/enchanted-library-cover.webp" },
  { id: "rune-match", category: "vocabulary", title: "Rune Match", description: "จับคู่คำศัพท์กับความหมายในการต่อสู้แบบปริศนา RPG", cover: "/games/cover/rune-match-cover.webp" },
  { id: "alchemists-synthesis", category: "vocabulary", title: "Alchemist's Synthesis", description: "ผสมคำศัพท์กับความหมายให้ถูกต้องเพื่อสร้างเวทมนตร์", cover: "/games/cover/cover-alchemists-synthesis.webp" },
  { id: "archers-revenge", category: "vocabulary", title: "Archer's Revenge", description: "ยิงเป้าหมายที่ตรงกับคำแปลหรือความหมายที่กำหนด", cover: "/games/cover/cover-archers-revenge.webp" },
  { id: "paladins-twin-soul", category: "vocabulary", title: "Paladin's Twin-Soul", description: "จับคู่พลังคำศัพท์ให้ถูกต้องเพื่อช่วยเป้าหมาย", cover: "/games/cover/cover-paladins-twin-soul.webp" },
  { id: "castle-defense", category: "sentence", title: "Castle Defense", description: "เก็บคำในประโยคให้ถูกลำดับเพื่อป้องกันปราสาท", cover: "/games/cover/castle-defense-cover.webp" },
  { id: "potion-rush", category: "sentence", title: "Potion Rush", description: "เรียงคำให้เป็นประโยคในภารกิจร้านปรุงยาแบบรวดเร็ว", cover: "/games/cover/potion-rush-cover.webp" },
  { id: "dungeon-liberator", category: "sentence", title: "Dungeon Liberator", description: "เก็บคำตามลำดับประโยคให้ถูกต้องแล้วหนีออกจากดันเจี้ยน", cover: "/games/cover/dungeon-liberator.webp" },
  { id: "spellweavers-run", category: "sentence", title: "Spellweaver's Run", description: "จับคำตามลำดับที่ถูกต้องเพื่อสร้างประโยคให้สมบูรณ์", cover: "/games/cover/cover-spellweavers-run.webp" },
  { id: "shadow-gate-dungeon", category: "sentence", title: "Shadow Gate Dungeon", description: "เปิดประตูด้วยการเก็บคำในประโยคตามลำดับที่ถูกต้อง", cover: "/games/cover/cover-shadow-gate-dungeon.webp" },
  { id: "rune-forge-chamber", category: "sentence", title: "Rune Forge Chamber", description: "แตะวงคำศัพท์ตามลำดับประโยคก่อนเตาหลอมจะเย็นลง", cover: "/games/cover/cover-rune-forge-chamber.webp" },
  { id: "village-guardian", category: "sentence", title: "Village Guardian", description: "ช่วยชาวบ้านด้วยการเรียงคำในประโยคให้ถูกต้อง", cover: "/games/cover/cover-village-guardian.webp" },
  { id: "labyrinth-goblin-king", category: "sentence", title: "Labyrinth of the Goblin King", description: "เดินเขาวงกตและเก็บคำตามลำดับประโยคให้ถูกต้อง", cover: "/games/cover/cover-labyrinth-of-the-goblin-king.webp" },
  { id: "abyssal-well", category: "sentence", title: "The Abyssal Well", description: "เล็งและยิงคำในประโยคตามลำดับที่ถูกต้อง", cover: "/games/cover/cover-the-abyssal-well.webp" },
  { id: "storm-castle-tower", category: "sentence", title: "Storm the Castle Tower", description: "ปีนหอคอยพร้อมเก็บคำในประโยคตามลำดับ", cover: "/games/cover/cover-storm-the-castle-tower.webp" },
  { id: "griffin-sky-joust", category: "sentence", title: "Griffin Sky-Joust", description: "โจมตีเป้าหมายตามลำดับคำในประโยคให้ถูกต้อง", cover: "/games/cover/cover-griffin-sky-joust.webp" },
  { id: "realm-carver", category: "sentence", title: "Realm Carver", description: "ยึดพื้นที่ด้วยการเรียงประโยคให้สมบูรณ์", cover: "/games/cover/cover-realm-carver.webp" },
  { id: "griffin-riders-escape", category: "sentence", title: "Griffin Rider's Escape", description: "บินผ่านประตูตามลำดับคำในประโยคให้ถูกต้อง", cover: "/games/cover/cover-griffin-riders-escape.webp" },
  { id: "devourer-slime", category: "sentence", title: "Devourer Slime", description: "เติบโตด้วยการเก็บคำในประโยคตามลำดับที่ถูกต้อง", cover: "/games/cover/cover-devourer-slime.webp" },
  { id: "haunted-library", category: "sentence", title: "The Haunted Library", description: "เคลื่อนที่ผ่านห้องและปลดล็อกประตูด้วยลำดับประโยคที่ถูกต้อง", cover: "/games/cover/cover-haunted-library.webp" },
  { id: "gryphon-patrol", category: "sentence", title: "Gryphon Patrol", description: "ลาดตระเวนบนท้องฟ้าและเล็งคำในประโยคให้ถูกต้อง", cover: "/games/cover/cover-gryphon-patrol.webp" },
]

export function isLiveLessonGameEnabled(gameId?: string | null) {
  return !!gameId && PLAYABLE_LIVE_LESSON_GAME_IDS.has(gameId)
}

function withEnabledFlag(game: LiveLessonGame): LiveLessonGame {
  return { ...game, enabled: isLiveLessonGameEnabled(game.id) }
}

export function getGamesByCategory(category?: LiveLessonGameCategory | null) {
  return LIVE_LESSON_GAMES.filter((game) => game.category === category).map(withEnabledFlag)
}

export function getEnabledGamesByCategory(category?: LiveLessonGameCategory | null) {
  return getGamesByCategory(category).filter((game) => game.enabled !== false)
}

export function getGameById(gameId?: string | null) {
  const game = LIVE_LESSON_GAMES.find((game) => game.id === gameId)
  return game ? withEnabledFlag(game) : undefined
}

export function getGameTutorial(gameId?: string | null, category?: LiveLessonGameCategory) {
  const game = getGameById(gameId)
  const isVocabulary = (game?.category || category) === "vocabulary"
  const actionByGame: Record<string, string> = {
    "dragon-flight": "แตะฝั่งคำตอบที่ถูก หรือกดลูกศร เพื่อเพิ่มฝูงมังกร",
    "wizard-vs-zombie": "ใช้จอยเดินไปเก็บลูกแก้วที่ตรงความหมาย ถูกตั้งแต่ครั้งแรกจึงได้คะแนน · ตอบถูกได้ ⚡ แตะร่ายเวทเพื่อผลักซอมบี้",
    "enchanted-library": "ใช้จอยเดินไปชนหนังสือที่มีคำแปลถูก ถูกตั้งแต่ครั้งแรกจึงได้คะแนน · เห็นป้าย ผี! ให้หลบหรือกดปุ่มโล่",
    "rune-match": "แตะ 2 แผ่นที่อยู่ติดกัน ซึ่งเป็นคำศัพท์กับคำแปลของกัน",
    "castle-defense": "เดินเก็บคำตามลำดับ ชนผิดซ้ำจะถอย 1 คำ ครบแล้วกด สร้าง เพื่อตั้งป้อม",
    "potion-rush": "ลากคำจากสายพานลงหม้อใต้ลูกค้า เรียงตามลำดับประโยค",
  }
  const targetByGame: Record<string, string> = {
    "rune-match": "บนกระดานมีทั้งคำศัพท์และคำแปลปนกันอยู่",
    "potion-rush": "ลูกค้าจะบอกประโยคที่อยากได้ในกรอบคำพูด",
  }

  return [
    targetByGame[gameId || ""] || (isVocabulary ? "คำเป้าหมายจะอยู่ด้านบนของจอ" : "ประโยคเป้าหมายจะอยู่ด้านบนของจอ"),
    actionByGame[gameId || ""] || game?.description || "ทำภารกิจตามคำสั่งบนหน้าจอ",
    isVocabulary
      ? "มีเวลา 60 วินาที ตอบถูก 1 คำได้ 1 คะแนน สูงสุด 10 คะแนน"
      : "มีเวลา 60 วินาที เรียงคำได้มากเท่าไรยิ่งได้คะแนนมาก สูงสุด 10 คะแนน",
  ]
}
