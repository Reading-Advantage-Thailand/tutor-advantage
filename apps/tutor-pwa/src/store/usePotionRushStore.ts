import { create } from 'zustand'

import {
  beltLabel,
  countWordsNeeded,
  freeBeltX,
  nextWordDelay,
  orderWords,
  patienceForOrder,
  pickBeltWord,
  pickFocusSlot,
  pickOrderSentence,
  wordKey,
  wordsMissingFromBelt,
} from '@/lib/games/potionRushOrders'

// --- Types ---

export interface SentenceItem {
  term: string
  translation: string
  id?: string
  thaiTranslation?: string
  audioUrl?: string
}

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'

export type CauldronState = 'IDLE' | 'BREWING' | 'COMPLETED'

export interface Cauldron {
  id: number
  state: CauldronState
  targetSentence: SentenceItem | null
  currentWords: string[]
}

export type CustomerType = 'orc' | 'elf' | 'wizard' | 'dwarf' | 'goblin' | 'human' | 'skeleton'

export interface Customer {
  id: string
  type: CustomerType
  request: SentenceItem
  patience: number // seconds
  maxPatience: number
  state: 'WAITING' | 'LEAVING_ANGRY' | 'LEAVING_HAPPY'
  cauldronId?: number // If served, which cauldron served them (for animation)
  leaveTimer?: number
}

export interface Ingredient {
  id: string
  word: string
  x: number
  y: number // usually fixed Y on the belt
  type: 'potion' | 'mushroom' | 'mineral' | 'herb'
  width: number
  isDragging: boolean
  isHeld?: boolean
  holdingSlotIndex?: number
}

export type PotionRushEffectType = 'SPLASH' | 'SMOKE' | 'SUCCESS'

export interface PotionRushEffect {
  id: string
  type: PotionRushEffectType
  x: number
  y: number
  age: number
  duration: number
  seed: number
}

/** The last word a pot turned away. `seq` changes with each one, so the same word twice still shows. */
export interface PotRejection {
  slot: number
  word: string
  seq: number
}

/** A short message for the player. `seq` changes with each one. */
export interface PotionRushHint {
  text: string
  seq: number
}

interface PotionRushState {
  // Game Status
  gameState: GameState
  score: number
  dayTime: number // 0 to 1 (Day progress)

  // Entities
  cauldrons: Cauldron[]
  customers: (Customer | null)[]
  conveyorItems: Ingredient[]
  effects: PotionRushEffect[]

  // Settings / Config
  baseBeltSpeed: number
  beltSpeed: number
  spawnRate: number
  vocabList: SentenceItem[]
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme'

  // Logic State
  /** Words brewed in order this round. */
  placedWords: number
  /** Words pots turned away this round. */
  wrongDrops: number
  completedSentences: number
  totalXpEarned: number
  timeToNextCustomerSpawn: number
  timeToNextIngredientSpawn: number
  /** Seconds since the belt last got a word someone needs right now. */
  timeSinceNextWord: number
  gameTime: number
  totalCustomerSpawns: number
  angryCustomers: number
  /** Sentences this round has already given to a customer. */
  usedTerms: string[]

  // What the player sees and touches
  /** The customer the order banner shows, and their pot. */
  focusedSlot: number
  /** The pot under a word being dragged. */
  dragTargetSlot: number | null
  lastRejection: PotRejection | null
  hint: PotionRushHint | null

  // Actions
  startGame: (vocabList: SentenceItem[], difficulty?: 'easy' | 'normal' | 'hard' | 'extreme') => void
  prepareTutorialScene: (vocabList: SentenceItem[], difficulty?: 'easy' | 'normal' | 'hard' | 'extreme', screenWidth?: number) => void
  pauseGame: () => void
  resumeGame: () => void
  /** Ends the round. `atGameTime` sets the clock when the deadline passed with no frames running. */
  endGame: (atGameTime?: number) => void

  // Logic
  tick: (dt: number, screenWidth: number) => void
  /** Puts the clock on real time after a slow frame. */
  syncGameTime: (gameTime: number) => void

  // Interaction
  handleDropIngredient: (
    cauldronIndex: number,
    ingredientId: string,
    dropPosition?: { x: number; y: number }
  ) => void
  handleServeCustomer: (
    customerId: string,
    cauldronIndex: number,
    servePosition?: { x: number; y: number }
  ) => void
  discardIngredient: (ingredientId: string) => void
  setIngredientDragging: (ingredientId: string, isDragging: boolean) => void
  spawnEffect: (type: PotionRushEffectType, x: number, y: number) => void
  handleHoldIngredient: (ingredientId: string, slotIndex: number, screenWidth?: number) => void
  releaseHold: (ingredientId: string) => void
  setFocusedSlot: (slot: number) => void
  setDragTargetSlot: (slot: number | null) => void
  showHint: (text: string) => void

  // Helpers
  reset: () => void
}

// --- Constants ---
const BELT_Y = 500 // Placeholder
const INGREDIENT_WIDTH = 80 // Placeholder
const LEAVE_DURATION = 1.5 // seconds to keep leaving customers on screen
const EFFECT_DURATIONS: Record<PotionRushEffectType, number> = {
  SPLASH: 0.6,
  SMOKE: 1.1,
  SUCCESS: 0.9,
}
// Room for the bigger belt words a projected stage draws.
const MIN_INGREDIENT_CENTER_SPACING = 160
const TUTORIAL_PATIENCE = 60
// How often the next spawned word is one a waiting customer needs right now.
const NEEDED_WORD_CHANCE = 0.6
// A needed word never stays away longer than this, or a round turns into waiting for one word.
const NEXT_WORD_GUARANTEE_SECONDS = 3
const CUSTOMER_INTERVAL_SECONDS = 9
// More customers than this much work only makes each word harder to find.
const MAX_WORDS_ON_ORDER = 12
// A wrong word costs some of the customer's patience, so guessing every word on the belt does not pay.
const WRONG_WORD_PATIENCE_COST = 3
// A right word cheers the customer up, so an order being worked on does not run out.
const RIGHT_WORD_PATIENCE_GAIN = 3
const ROUND_SECONDS = 60
const CUSTOMER_EFFECT_Y = 230
const NO_CUSTOMER_HINT = 'หม้อนี้ยังไม่มีลูกค้า'

const CUSTOMER_TYPES: CustomerType[] = ['orc', 'elf', 'wizard', 'dwarf', 'goblin', 'human', 'skeleton']
const INGREDIENT_TYPES: Ingredient['type'][] = ['potion', 'mushroom', 'mineral', 'herb']

const randomId = () => Math.random().toString(36).substr(2, 9)
const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]
const emptyCauldron = (id: number): Cauldron => ({ id, state: 'IDLE', targetSentence: null, currentWords: [] })
const emptyCauldrons = () => [emptyCauldron(0), emptyCauldron(1), emptyCauldron(2)]

let nextSeq = 1

export const usePotionRushStore = create<PotionRushState>((set, get) => ({
  gameState: 'MENU',
  score: 0,
  dayTime: 0,

  cauldrons: emptyCauldrons(),
  customers: [null, null, null],
  conveyorItems: [],
  effects: [],

  baseBeltSpeed: 50,
  beltSpeed: 50, // Pixels per second
  spawnRate: 2100, // ms
  vocabList: [],
  difficulty: 'normal',

  placedWords: 0,
  wrongDrops: 0,
  completedSentences: 0,
  totalXpEarned: 0,
  timeToNextCustomerSpawn: 0,
  timeToNextIngredientSpawn: 0,
  timeSinceNextWord: 0,
  gameTime: 0,
  totalCustomerSpawns: 0,
  angryCustomers: 0,
  usedTerms: [],

  focusedSlot: 0,
  dragTargetSlot: null,
  lastRejection: null,
  hint: null,

  startGame: (vocabList, difficulty = 'normal') => {
    const diffSettings = {
      easy: { baseBeltSpeed: 45, spawnRate: 650 },
      normal: { baseBeltSpeed: 65, spawnRate: 550 },
      hard: { baseBeltSpeed: 85, spawnRate: 475 },
      extreme: { baseBeltSpeed: 105, spawnRate: 400 },
    }[difficulty]

    set({
      gameState: 'PLAYING',
      score: 0,
      dayTime: 0,
      customers: [null, null, null],
      conveyorItems: [],
      effects: [],
      placedWords: 0,
      wrongDrops: 0,
      completedSentences: 0,
      totalXpEarned: 0,
      beltSpeed: diffSettings.baseBeltSpeed,
      baseBeltSpeed: diffSettings.baseBeltSpeed,
      spawnRate: diffSettings.spawnRate,
      vocabList,
      difficulty,
      timeToNextCustomerSpawn: 0, // Immediate spawn
      timeToNextIngredientSpawn: 0.5,
      timeSinceNextWord: 0,
      gameTime: 0,
      totalCustomerSpawns: 0,
      angryCustomers: 0,
      usedTerms: [],
      cauldrons: emptyCauldrons(),
      focusedSlot: 0,
      dragTargetSlot: null,
      lastRejection: null,
      hint: null,
    })
  },

  prepareTutorialScene: (vocabList, difficulty = 'normal', screenWidth = 390) => {
    // The shortest sentence, so the walkthrough reaches the end soon at any level.
    const sentence = [...vocabList]
      .filter((item) => orderWords(item.term).length > 0)
      .sort((a, b) => orderWords(a.term).length - orderWords(b.term).length)[0] ?? {
      id: 'tutorial-sentence',
      term: 'Students read the article carefully',
      translation: 'นักเรียนอ่านบทความอย่างละเอียด',
      thaiTranslation: 'นักเรียนอ่านบทความอย่างละเอียด',
    }
    const words = orderWords(sentence.term)
    const sceneWidth = Math.max(390, screenWidth)
    // Every word starts on the belt, however long the sentence.
    const firstWordAt = 0.08
    const wordStep = Math.min(0.12, 0.84 / Math.max(1, words.length - 1))
    const tutorialCustomer: Customer = {
      id: 'tutorial-customer',
      type: 'wizard',
      request: sentence,
      patience: TUTORIAL_PATIENCE,
      maxPatience: TUTORIAL_PATIENCE,
      state: 'WAITING',
    }
    const tutorialItems: Ingredient[] = words.map((word, index) => ({
      id: `tutorial-ingredient-${index}`,
      word: beltLabel(word, index === 0),
      x: sceneWidth * (firstWordAt + index * wordStep),
      y: BELT_Y,
      type: INGREDIENT_TYPES[index % INGREDIENT_TYPES.length],
      width: INGREDIENT_WIDTH,
      isDragging: false,
    }))
    const diffSettings = {
      easy: { baseBeltSpeed: 45, spawnRate: 650 },
      normal: { baseBeltSpeed: 65, spawnRate: 550 },
      hard: { baseBeltSpeed: 85, spawnRate: 475 },
      extreme: { baseBeltSpeed: 105, spawnRate: 400 },
    }[difficulty]

    set({
      gameState: 'PAUSED',
      score: 0,
      dayTime: 0,
      customers: [tutorialCustomer, null, null],
      conveyorItems: tutorialItems,
      effects: [],
      placedWords: 0,
      wrongDrops: 0,
      completedSentences: 0,
      totalXpEarned: 0,
      beltSpeed: diffSettings.baseBeltSpeed,
      baseBeltSpeed: diffSettings.baseBeltSpeed,
      spawnRate: diffSettings.spawnRate,
      vocabList,
      difficulty,
      timeToNextCustomerSpawn: TUTORIAL_PATIENCE,
      timeToNextIngredientSpawn: 999,
      timeSinceNextWord: 0,
      gameTime: 0,
      totalCustomerSpawns: 1,
      angryCustomers: 0,
      usedTerms: [sentence.term],
      cauldrons: emptyCauldrons(),
      focusedSlot: 0,
      dragTargetSlot: null,
      lastRejection: null,
      hint: null,
    })
  },

  pauseGame: () => set({ gameState: 'PAUSED' }),
  resumeGame: () => set({ gameState: 'PLAYING' }),
  endGame: (atGameTime) => set(atGameTime === undefined ? { gameState: 'GAME_OVER' } : { gameState: 'GAME_OVER', gameTime: atGameTime }),

  reset: () => set({
      gameState: 'MENU',
      customers: [null, null, null],
      cauldrons: emptyCauldrons(),
      conveyorItems: [],
      effects: [],
      score: 0,
      placedWords: 0,
      wrongDrops: 0,
      completedSentences: 0,
      vocabList: [],
      totalXpEarned: 0,
      difficulty: 'normal',
      timeSinceNextWord: 0,
      gameTime: 0,
      totalCustomerSpawns: 0,
      angryCustomers: 0,
      usedTerms: [],
      baseBeltSpeed: 50,
      beltSpeed: 50,
      spawnRate: 2100,
      focusedSlot: 0,
      dragTargetSlot: null,
      lastRejection: null,
      hint: null,
  }),

  tick: (dt, screenWidth) => {
      const {
          gameState, conveyorItems, customers, dayTime,
          effects, baseBeltSpeed, cauldrons,
          timeToNextCustomerSpawn, timeToNextIngredientSpawn, timeSinceNextWord, spawnRate, vocabList,
          gameTime, angryCustomers, totalCustomerSpawns, usedTerms, focusedSlot
      } = get()

      if (gameState !== 'PLAYING') return

      const nextGameTime = gameTime + dt
      if (nextGameTime >= ROUND_SECONDS) {
          set({ gameState: 'GAME_OVER', gameTime: nextGameTime })
          return
      }

      let nextAngryCustomers = angryCustomers
      let nextTotalCustomerSpawns = totalCustomerSpawns
      let nextUsedTerms = usedTerms

      // --- 1. CUSTOMERS ---
      let nextCustomers = [...customers]

      let nextCustomerTimer = timeToNextCustomerSpawn - dt
      if (nextCustomerTimer <= 0 && vocabList.length > 0) {
          const emptySlotIndex = nextCustomers.findIndex(c => c === null)
          const anyoneWaiting = nextCustomers.some(c => c?.state === 'WAITING')
          const orderIsFull = anyoneWaiting && countWordsNeeded(nextCustomers, cauldrons) > MAX_WORDS_ON_ORDER
          const activeTerms = nextCustomers.flatMap(c => (c ? [c.request.term] : []))
          const sentence = pickOrderSentence(vocabList, activeTerms, nextUsedTerms)
          if (emptySlotIndex !== -1 && !orderIsFull && sentence) {
             const patience = patienceForOrder(sentence.term)
             nextCustomers[emptySlotIndex] = {
                  id: randomId(),
                  type: pickRandom(CUSTOMER_TYPES),
                  request: sentence,
                  patience,
                  maxPatience: patience,
                  state: 'WAITING',
                  leaveTimer: undefined
             }
             nextTotalCustomerSpawns += 1
             nextUsedTerms = [...nextUsedTerms, sentence.term]
             nextCustomerTimer = CUSTOMER_INTERVAL_SECONDS
          } else {
             // Full or busy: look again soon
             nextCustomerTimer = 1
          }
      }

      // Patience. Nobody loses marks when a customer gives up: only the slot turns over.
      let someoneLeft = false
      nextCustomers = nextCustomers.map(c => {
          if (!c) return null

          if (c.state !== 'WAITING') {
             const remaining = (c.leaveTimer ?? LEAVE_DURATION) - dt
             if (remaining <= 0) return null // Despawn
             return { ...c, leaveTimer: remaining }
          }

          const newPatience = c.patience - dt
          if (newPatience <= 0) {
              nextAngryCustomers += 1
              someoneLeft = true
              return { ...c, patience: 0, state: 'LEAVING_ANGRY' as const, leaveTimer: LEAVE_DURATION }
          }
          return { ...c, patience: newPatience }
      })
      if (someoneLeft && !nextCustomers.some(c => c?.state === 'WAITING')) {
          nextCustomerTimer = Math.min(nextCustomerTimer, 1)
      }

      // A pot is emptied once its customer has gone.
      let nextCauldrons = cauldrons
      cauldrons.forEach((cauldron, i) => {
          const customer = nextCustomers[i]
          if ((!customer || customer.state === 'LEAVING_ANGRY') && cauldron.state !== 'IDLE') {
              if (nextCauldrons === cauldrons) nextCauldrons = [...cauldrons]
              nextCauldrons[i] = emptyCauldron(i)
          }
      })

      // --- 2. BELT ---
      // The wide layout has more conveyor distance. Scale world speed so an
      // ingredient still crosses the visible belt in roughly the same time.
      const widthScale = Math.max(1, screenWidth / 390)
      const targetSpeed = baseBeltSpeed * widthScale
      // Keep consecutive ingredients close without letting their 80px
      // sprites overlap, including on the responsive wide tutor layout.
      const wordGapSeconds = Math.max(spawnRate / 1000, MIN_INGREDIENT_CENTER_SPACING / Math.max(targetSpeed, 1))

      const nextItems: Ingredient[] = []
      conveyorItems.forEach(item => {
          if (item.isDragging || item.isHeld) {
              nextItems.push(item)
          } else {
              const nextX = item.x - (targetSpeed * dt)
              // A word that rolls off comes round again if someone still needs it.
              if (nextX > -200) nextItems.push({ ...item, x: nextX })
          }
      })

      // --- 3. NEW WORDS ---
      let nextIngredientTimer = timeToNextIngredientSpawn - dt
      let nextTimeSinceNextWord = timeSinceNextWord + dt
      if (nextIngredientTimer <= 0) {
          const supply = wordsMissingFromBelt(nextCustomers, nextCauldrons, nextItems.map(item => item.word))
          if (supply.nextWords.length === 0) nextTimeSinceNextWord = 0
          const preferNextWord = nextTimeSinceNextWord >= NEXT_WORD_GUARANTEE_SECONDS || Math.random() < NEEDED_WORD_CHANCE
          const picked = pickBeltWord(supply, preferNextWord)
          if (picked) {
              const label = beltLabel(picked.word, picked.isFirstWord)
              nextItems.push({
                  id: randomId(),
                  word: label,
                  x: screenWidth + 100,
                  y: BELT_Y,
                  type: pickRandom(INGREDIENT_TYPES),
                  width: INGREDIENT_WIDTH,
                  isDragging: false
              })
              if (supply.nextWords.includes(picked)) nextTimeSinceNextWord = 0
              nextIngredientTimer = nextWordDelay(wordGapSeconds, label, targetSpeed)
          } else {
              nextIngredientTimer = wordGapSeconds
          }
      }

      const nextEffects = effects.length === 0
        ? effects
        : effects
            .map(effect => ({ ...effect, age: effect.age + dt }))
            .filter(effect => effect.age < effect.duration)

      set({
        conveyorItems: nextItems,
        customers: nextCustomers,
        dayTime: dayTime + (dt * 0.01),
        effects: nextEffects,
        beltSpeed: targetSpeed,
        cauldrons: nextCauldrons,
        timeToNextCustomerSpawn: nextCustomerTimer,
        timeToNextIngredientSpawn: nextIngredientTimer,
        timeSinceNextWord: nextTimeSinceNextWord,
        gameTime: nextGameTime,
        angryCustomers: nextAngryCustomers,
        totalCustomerSpawns: nextTotalCustomerSpawns,
        usedTerms: nextUsedTerms,
        focusedSlot: pickFocusSlot(focusedSlot, nextCustomers),
      })
  },

  syncGameTime: (gameTime) => {
    if (Math.abs(gameTime - get().gameTime) > 0.05) set({ gameTime })
  },

  handleDropIngredient: (cauldronIndex, ingredientId, dropPosition) => {
    const { cauldrons, conveyorItems, customers } = get()
    const ingredient = conveyorItems.find(i => i.id === ingredientId)
    const cauldron = cauldrons[cauldronIndex]

    if (!ingredient || !cauldron) return

    const emitEffect = (type: PotionRushEffectType) => {
      if (dropPosition) get().spawnEffect(type, dropPosition.x, dropPosition.y)
    }
    const reject = (changes: Partial<PotionRushState>) => {
      set({ ...changes, lastRejection: { slot: cauldronIndex, word: ingredient.word, seq: nextSeq++ } })
    }

    // Strict 1:1 Mapping: Cauldron matches Customer[cauldronIndex]
    const customer = customers[cauldronIndex]

    // Nobody is waiting at this pot. The word stays where it was, at no cost.
    if (!customer || customer.state !== 'WAITING') {
      reject({})
      get().showHint(NO_CUSTOMER_HINT)
      return
    }

    const targetWords = orderWords(customer.request.term)
    const placed = cauldron.state === 'BREWING' ? cauldron.currentWords.length : 0
    const expected = targetWords[placed]

    // A wrong word never spoils the pot: it goes back and the pot keeps its words.
    if (expected === undefined || wordKey(expected) !== wordKey(ingredient.word)) {
      const nextCustomers = [...customers]
      nextCustomers[cauldronIndex] = {
        ...customer,
        patience: Math.max(0, customer.patience - WRONG_WORD_PATIENCE_COST),
      }
      reject({ customers: nextCustomers, wrongDrops: get().wrongDrops + 1, focusedSlot: cauldronIndex })
      emitEffect('SMOKE')
      return
    }

    emitEffect('SPLASH')

    const nextWords = [...(cauldron.state === 'BREWING' ? cauldron.currentWords : []), expected]
    const finished = nextWords.length === targetWords.length
    const nextCauldrons = [...cauldrons]
    nextCauldrons[cauldronIndex] = {
      id: cauldronIndex,
      state: finished ? 'COMPLETED' : 'BREWING',
      targetSentence: customer.request,
      currentWords: nextWords,
    }

    const nextCustomer: Customer = {
      ...customer,
      patience: Math.min(customer.maxPatience, customer.patience + RIGHT_WORD_PATIENCE_GAIN),
    }

    const nextCustomers = [...customers]
    nextCustomers[cauldronIndex] = nextCustomer

    set({
      conveyorItems: get().conveyorItems.filter(i => i.id !== ingredientId),
      cauldrons: nextCauldrons,
      customers: nextCustomers,
      placedWords: get().placedWords + 1,
      focusedSlot: cauldronIndex,
    })

    // A full pot goes to its customer by itself: carrying it over practises no English.
    if (finished) {
      const servePosition = dropPosition ? { x: dropPosition.x, y: CUSTOMER_EFFECT_Y } : undefined
      get().handleServeCustomer(customer.id, cauldronIndex, servePosition)
    }
  },

  handleServeCustomer: (customerId, cauldronIndex, servePosition) => {
     const { customers, cauldrons, completedSentences, timeToNextCustomerSpawn } = get()
     const cauldron = cauldrons[cauldronIndex]

     if (cauldron.state !== 'COMPLETED') return

     // Strict Index Match
     const customer = customers[cauldronIndex]
     if (!customer || customer.id !== customerId || customer.state !== 'WAITING') return

     if (customer.request.term !== cauldron.targetSentence?.term) return

     const nextCustomers = [...customers]
     nextCustomers[cauldronIndex] = { ...customer, state: 'LEAVING_HAPPY', leaveTimer: LEAVE_DURATION }

     const anotherCustomerWaiting = nextCustomers.some(c => c?.state === 'WAITING')

     // The pot stays finished until its customer has gone. Every served pot is
     // worth exactly one point, and only the timer ends the round.
     set({
         customers: nextCustomers,
         score: completedSentences + 1,
         completedSentences: completedSentences + 1,
         // Nobody left to serve: bring the next customer in now instead of idling.
         timeToNextCustomerSpawn: anotherCustomerWaiting ? timeToNextCustomerSpawn : Math.min(timeToNextCustomerSpawn, 1),
     })

     // Calculate XP based on updated state
     set({ totalXpEarned: calculatePotionRushXP(get()) })

     if (servePosition) {
       get().spawnEffect('SUCCESS', servePosition.x, servePosition.y)
     }
  },

  // The word leaves the belt. If someone still needs it, it comes round again.
  discardIngredient: (ingredientId) => {
    const { conveyorItems } = get()
    set({ conveyorItems: conveyorItems.filter(item => item.id !== ingredientId) })
  },

  setIngredientDragging: (ingredientId, isDragging) => {
    const { conveyorItems } = get()
    const onBelt = (item: Ingredient) => item.id !== ingredientId && !item.isHeld && !item.isDragging
    set({
      conveyorItems: conveyorItems.map(item => {
        if (item.id !== ingredientId) return item
        if (isDragging || item.isHeld) return { ...item, isDragging }
        return { ...item, isDragging, x: freeBeltX(item.x, conveyorItems.filter(onBelt).map(other => other.x)) }
      })
    })
  },

  handleHoldIngredient: (ingredientId, slotIndex, screenWidth = 390) => {
    const { conveyorItems } = get()
    const item = conveyorItems.find(i => i.id === ingredientId)
    if (!item) return

    // Under each pot.
    const slotX = (Math.max(390, screenWidth) * (slotIndex + 0.5)) / 3
    const slotY = 510 // Hold slot Y coordinate

    const onBelt = conveyorItems.filter(i => i.id !== ingredientId && !i.isHeld && !i.isDragging).map(i => i.x)
    const nextItems = conveyorItems.map(i => {
      // If another item is in the target holding slot, send it back to the conveyor belt
      if (i.isHeld && i.holdingSlotIndex === slotIndex && i.id !== ingredientId) {
        return { ...i, isHeld: false, holdingSlotIndex: undefined, y: BELT_Y, x: freeBeltX(i.x, onBelt) }
      }
      if (i.id === ingredientId) {
        return { ...i, isHeld: true, holdingSlotIndex: slotIndex, x: slotX, y: slotY }
      }
      return i
    })

    set({ conveyorItems: nextItems })
  },

  releaseHold: (ingredientId) => {
    const { conveyorItems } = get()
    const onBelt = conveyorItems.filter(i => i.id !== ingredientId && !i.isHeld && !i.isDragging).map(i => i.x)
    const nextItems = conveyorItems.map(i => {
      if (i.id === ingredientId) {
        return { ...i, isHeld: false, holdingSlotIndex: undefined, y: BELT_Y, x: freeBeltX(i.x, onBelt) }
      }
      return i
    })
    set({ conveyorItems: nextItems })
  },

  spawnEffect: (type, x, y) => {
    const effect: PotionRushEffect = {
      id: Math.random().toString(36).slice(2, 10),
      type,
      x,
      y,
      age: 0,
      duration: EFFECT_DURATIONS[type],
      seed: Math.random(),
    }

    set(state => ({ effects: [...state.effects, effect] }))
  },

  setFocusedSlot: (slot) => {
    if (get().customers[slot]) set({ focusedSlot: slot })
  },

  setDragTargetSlot: (slot) => {
    if (get().dragTargetSlot !== slot) set({ dragTargetSlot: slot })
  },

  showHint: (text) => set({ hint: { text, seq: nextSeq++ } }),

}))

/** Words placed against words tried. Only shown on the game's own end screen. */
export function potionRushAccuracy(state: Pick<PotionRushState, 'placedWords' | 'wrongDrops'>): number {
  const tried = state.placedWords + state.wrongDrops
  return tried > 0 ? state.placedWords / tried : 0
}

export function calculatePotionRushXP(state: PotionRushState): number {
  const { completedSentences, gameTime, angryCustomers, totalCustomerSpawns } = state

  if (completedSentences === 0) return 0

  // Base XP: 1 per completed sentence, max 5
  const baseXP = Math.min(5, completedSentences)

  let bonus = 0

  // Accuracy bonus: +2 if no angry customers, +1 if accuracy >= 70%
  const totalAttempts = totalCustomerSpawns
  const accuracy = totalAttempts > 0 ? (totalAttempts - angryCustomers) / totalAttempts : 1
  if (accuracy === 1 && completedSentences > 0) {
    bonus += 2
  } else if (accuracy >= 0.7) {
    bonus += 1
  }

  // Survival bonus: the round can no longer be lost
  bonus += 1

  // Speed bonus: +1 if game completed in under 2 minutes
  if (gameTime < 120) bonus += 1

  // Progression bonus: +1 if completed 3+ sentences
  if (completedSentences >= 3) bonus += 1

  return Math.min(10, baseXP + bonus)
}
