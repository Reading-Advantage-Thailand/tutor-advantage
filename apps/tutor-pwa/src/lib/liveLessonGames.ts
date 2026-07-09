export type LiveLessonGameCategory = "vocabulary" | "sentence"

export interface LiveLessonGame {
  id: string
  category: LiveLessonGameCategory
  title: string
  description: string
}

export const LIVE_LESSON_GAMES: LiveLessonGame[] = [
  { id: "dragon-rider", category: "vocabulary", title: "Dragon Rider", description: "Choose the correct vocabulary gate while flying through the course." },
  { id: "dragon-flight", category: "vocabulary", title: "Dragon Flight", description: "Build power by choosing the correct word meaning." },
  { id: "wizard-vs-zombie", category: "vocabulary", title: "Wizard vs Zombie", description: "Move, collect correct vocabulary, and survive the arena." },
  { id: "enchanted-library", category: "vocabulary", title: "Enchanted Library", description: "Collect the right books and avoid wrong meanings." },
  { id: "rune-match", category: "vocabulary", title: "Rune Match", description: "Match vocabulary pairs in an RPG puzzle battle." },
  { id: "alchemists-synthesis", category: "vocabulary", title: "Alchemist's Synthesis", description: "Combine vocabulary and meanings to synthesize spells." },
  { id: "archers-revenge", category: "vocabulary", title: "Archer's Revenge", description: "Shoot targets that match the current translation." },
  { id: "paladins-twin-soul", category: "vocabulary", title: "Paladin's Twin-Soul", description: "Match word powers and rescue the target." },
  { id: "castle-defense", category: "sentence", title: "Castle Defense", description: "Collect sentence words to defend the castle." },
  { id: "potion-rush", category: "sentence", title: "Potion Rush", description: "Build sentence orders in a fast shop challenge." },
  { id: "dungeon-liberator", category: "sentence", title: "Dungeon Liberator", description: "Collect words in order and escape." },
  { id: "spellweavers-run", category: "sentence", title: "Spellweaver's Run", description: "Catch words in the correct sentence order." },
  { id: "shadow-gate-dungeon", category: "sentence", title: "Shadow Gate Dungeon", description: "Open gates by collecting ordered sentence words." },
  { id: "rune-forge-chamber", category: "sentence", title: "Rune Forge Chamber", description: "Tap word circles in order before the forge cools." },
  { id: "village-guardian", category: "sentence", title: "Village Guardian", description: "Rescue villagers in the correct sentence order." },
  { id: "labyrinth-goblin-king", category: "sentence", title: "Labyrinth of the Goblin King", description: "Navigate the maze and collect words in order." },
  { id: "abyssal-well", category: "sentence", title: "The Abyssal Well", description: "Aim and fire at sentence words in sequence." },
  { id: "storm-castle-tower", category: "sentence", title: "Storm the Castle Tower", description: "Climb while collecting words in order." },
  { id: "griffin-sky-joust", category: "sentence", title: "Griffin Sky-Joust", description: "Strike targets in the correct sentence order." },
  { id: "realm-carver", category: "sentence", title: "Realm Carver", description: "Claim territory by completing sentence order." },
  { id: "griffin-riders-escape", category: "sentence", title: "Griffin Rider's Escape", description: "Fly through gates in sentence order." },
  { id: "devourer-slime", category: "sentence", title: "Devourer Slime", description: "Grow by collecting sentence words in order." },
  { id: "haunted-library", category: "sentence", title: "The Haunted Library", description: "Move through rooms and unlock ordered sentence doors." },
  { id: "gryphon-patrol", category: "sentence", title: "Gryphon Patrol", description: "Patrol the sky and target sentence words." },
]

export function getGamesByCategory(category?: LiveLessonGameCategory | null) {
  return LIVE_LESSON_GAMES.filter((game) => game.category === category)
}

export function getGameById(gameId?: string | null) {
  return LIVE_LESSON_GAMES.find((game) => game.id === gameId)
}
