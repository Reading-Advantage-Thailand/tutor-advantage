import { create } from 'zustand'

// --- Types ---

export interface SentenceItem {
  term: string
  translation: string
  id?: string
}

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'

export type CauldronState = 'IDLE' | 'BREWING' | 'WARNING' | 'COMPLETED'

export interface Cauldron {
  id: number
  state: CauldronState
  targetSentence: SentenceItem | null
  currentWords: string[]
  // For visual feedback
  shake: boolean
}

export type CustomerType = 'orc' | 'elf' | 'wizard' | 'dwarf' | 'goblin' | 'human' | 'skeleton'

export interface Customer {
  id: string
  type: CustomerType
  request: SentenceItem
  patience: number // 0-100 or seconds
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

interface PotionRushState {
  // Game Status
  gameState: GameState
  score: number
  reputation: number // 0-100%
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
  activeWordPool: string[]
  completedSentences: number
  totalXpEarned: number
  timeToNextCustomerSpawn: number
  timeToNextIngredientSpawn: number
  gameTime: number
  totalCustomerSpawns: number
  angryCustomers: number

  // Actions
  startGame: (vocabList: SentenceItem[], difficulty?: 'easy' | 'normal' | 'hard' | 'extreme') => void
  pauseGame: () => void
  resumeGame: () => void
  endGame: () => void
  
  // Logic
  tick: (dt: number, screenWidth: number) => void
  spawnCustomer: () => void
  spawnIngredient: (screenWidth: number) => void
  
  // Interaction
  handleDropIngredient: (
    cauldronIndex: number,
    ingredientId: string,
    dropPosition?: { x: number; y: number }
  ) => void
  handleDumpCauldron: (cauldronIndex: number) => void
  handleServeCustomer: (
    customerId: string,
    cauldronIndex: number,
    servePosition?: { x: number; y: number }
  ) => void
  discardIngredient: (ingredientId: string) => void
  setIngredientDragging: (ingredientId: string, isDragging: boolean) => void
  spawnEffect: (type: PotionRushEffectType, x: number, y: number) => void
  
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
const BASE_PATIENCE = 60

export const usePotionRushStore = create<PotionRushState>((set, get) => ({
  gameState: 'MENU',
  score: 0,
  reputation: 100,
  dayTime: 0,
  
  cauldrons: [
    { id: 0, state: 'IDLE', targetSentence: null, currentWords: [], shake: false },
    { id: 1, state: 'IDLE', targetSentence: null, currentWords: [], shake: false },
    { id: 2, state: 'IDLE', targetSentence: null, currentWords: [], shake: false },
  ],
  customers: [null, null, null],
  conveyorItems: [],
  effects: [],
  
  baseBeltSpeed: 50,
  beltSpeed: 50, // Pixels per second
  spawnRate: 2100, // ms
  vocabList: [],
  difficulty: 'normal',
  
  activeWordPool: [],
  completedSentences: 0,
  totalXpEarned: 0,
  timeToNextCustomerSpawn: 0,
  timeToNextIngredientSpawn: 0,
  gameTime: 0,
  totalCustomerSpawns: 0,
  angryCustomers: 0,
  
  startGame: (vocabList, difficulty = 'normal') => {
    const diffSettings = {
      easy: { baseBeltSpeed: 35, spawnRate: 2800 },
      normal: { baseBeltSpeed: 50, spawnRate: 2100 },
      hard: { baseBeltSpeed: 70, spawnRate: 1600 },
      extreme: { baseBeltSpeed: 90, spawnRate: 1200 },
    }[difficulty]

    set({
      gameState: 'PLAYING',
      score: 0,
      reputation: 100,
      dayTime: 0,
      customers: [null, null, null],
      conveyorItems: [],
      effects: [],
      activeWordPool: [],
      completedSentences: 0,
      totalXpEarned: 0,
      beltSpeed: diffSettings.baseBeltSpeed,
      baseBeltSpeed: diffSettings.baseBeltSpeed,
      spawnRate: diffSettings.spawnRate,
      vocabList,
      difficulty,
      timeToNextCustomerSpawn: 0, // Immediate spawn
      timeToNextIngredientSpawn: 0.5,
      gameTime: 0,
      totalCustomerSpawns: 0,
      angryCustomers: 0,
      cauldrons: [
        { id: 0, state: 'IDLE', targetSentence: null, currentWords: [], shake: false },
        { id: 1, state: 'IDLE', targetSentence: null, currentWords: [], shake: false },
        { id: 2, state: 'IDLE', targetSentence: null, currentWords: [], shake: false },
      ],
    })
  },
  
  pauseGame: () => set({ gameState: 'PAUSED' }),
  resumeGame: () => set({ gameState: 'PLAYING' }),
  endGame: () => set({ gameState: 'GAME_OVER' }),
  
  reset: () => set({
      gameState: 'MENU',
      customers: [null, null, null],
      conveyorItems: [],
      effects: [],
      score: 0,
      reputation: 100,
      activeWordPool: [],
      completedSentences: 0,
      vocabList: [],
      totalXpEarned: 0,
      difficulty: 'normal',
      gameTime: 0,
      totalCustomerSpawns: 0,
      angryCustomers: 0,
      baseBeltSpeed: 50,
      beltSpeed: 50,
      spawnRate: 2100,
  }),

  spawnCustomer: () => {
      const { customers, gameState, activeWordPool, vocabList, completedSentences, totalCustomerSpawns } = get()
      if (gameState !== 'PLAYING' || vocabList.length === 0) return
      
      // Find first empty slot
      const emptySlotIndex = customers.findIndex(c => c === null)
      if (emptySlotIndex === -1) return

      const randomVocab = vocabList[Math.floor(Math.random() * vocabList.length)]
      const types: CustomerType[] = ['orc', 'elf', 'wizard', 'dwarf', 'goblin', 'human', 'skeleton']
      const randomType = types[Math.floor(Math.random() * types.length)]

      // Difficulty Scaling
      // Patience decreases by 10% per sentence
      const scaledPatience = BASE_PATIENCE * Math.pow(0.9, completedSentences)

      const newCustomer: Customer = {
          id: Math.random().toString(36).substr(2, 9),
          type: randomType,
          request: randomVocab,
          patience: scaledPatience,
          maxPatience: scaledPatience,
          state: 'WAITING',
          leaveTimer: undefined
      }

      // Add words to active pool
      const newWords = randomVocab.term.split(' ')
      const nextCustomers = [...customers]
      nextCustomers[emptySlotIndex] = newCustomer
      
      set({ 
          customers: nextCustomers,
          activeWordPool: [...activeWordPool, ...newWords],
          totalCustomerSpawns: totalCustomerSpawns + 1
      })
  },

  spawnIngredient: (screenWidth) => {
      const { conveyorItems, gameState, activeWordPool } = get()
      if (gameState !== 'PLAYING') return
      if (activeWordPool.length === 0) return

      // Pick only from active pool
      const poolIndex = Math.floor(Math.random() * activeWordPool.length)
      const randomWord = activeWordPool[poolIndex]
      
      const types: Ingredient['type'][] = ['potion', 'mushroom', 'mineral', 'herb']
      const randomType = types[Math.floor(Math.random() * types.length)]

      const newItem: Ingredient = {
          id: Math.random().toString(36).substr(2, 9),
          word: randomWord,
          x: screenWidth + 100,
          y: BELT_Y,
          type: randomType,
          width: INGREDIENT_WIDTH,
          isDragging: false
      }

      // Remove the word from the active pool
      const nextActiveWordPool = [...activeWordPool]
      nextActiveWordPool.splice(poolIndex, 1)

      set({ 
          conveyorItems: [...conveyorItems, newItem],
          activeWordPool: nextActiveWordPool
      })
  },

  tick: (dt, screenWidth) => {
      const { 
          gameState, conveyorItems, customers, dayTime, reputation, 
          effects, activeWordPool, baseBeltSpeed, completedSentences, cauldrons,
          timeToNextCustomerSpawn, timeToNextIngredientSpawn, spawnRate, vocabList,
          gameTime, angryCustomers, totalCustomerSpawns
      } = get()
      
      if (gameState !== 'PLAYING') return

      const nextGameTime = gameTime + dt
      let nextAngryCustomers = angryCustomers
      let nextTotalCustomerSpawns = totalCustomerSpawns

      // --- 1. SPAWN LOGIC & CUSTOMER MANAGEMENT ---
      // We process customers first so we can modify the array in place if needed before movement logic?
      // Actually, let's establish "next" states.

      let nextCustomers = [...customers]
      let nextActiveWordPool = [...activeWordPool]
      
      // A. Customer Spawning
      const currentPatience = BASE_PATIENCE * Math.pow(0.9, completedSentences)
      const customerSpawnInterval = currentPatience / 3
      
      let nextCustomerTimer = timeToNextCustomerSpawn - dt
      if (nextCustomerTimer <= 0 && vocabList.length > 0) {
          // Attempt spawn
          const emptySlotIndex = nextCustomers.findIndex(c => c === null)
          if (emptySlotIndex !== -1) {
             const randomVocab = vocabList[Math.floor(Math.random() * vocabList.length)]
             const types: CustomerType[] = ['orc', 'elf', 'wizard', 'dwarf', 'goblin', 'human', 'skeleton']
             const randomType = types[Math.floor(Math.random() * types.length)]
             const scaledPatience = currentPatience // Already calculated above

             const newCustomer: Customer = {
                  id: Math.random().toString(36).substr(2, 9),
                  type: randomType,
                  request: randomVocab,
                  patience: scaledPatience,
                  maxPatience: scaledPatience,
                  state: 'WAITING',
                  leaveTimer: undefined
             }
             
             nextCustomers[emptySlotIndex] = newCustomer
             nextActiveWordPool.push(...randomVocab.term.split(' '))
             nextTotalCustomerSpawns += 1
             
             nextCustomerTimer = customerSpawnInterval
          } else {
             // If full, retry sooner
             nextCustomerTimer = 1 
          }
      }

      // --- 2. MOVEMENT & TIMERS ---

      // Calculate speed
      const targetSpeed = baseBeltSpeed * Math.pow(1.1, completedSentences)

      // Move Conveyor Items & Recycle Words
      const recycledWords: string[] = []
      const nextItems: Ingredient[] = []
      
      conveyorItems.forEach(item => {
          if (item.isDragging) {
              nextItems.push(item)
          } else {
              const nextX = item.x - (targetSpeed * dt)
              if (nextX > -200) {
                  nextItems.push({ ...item, x: nextX })
              } else {
                  // Despawned - recycle word
                  recycledWords.push(item.word)
              }
          }
      })

      // Update Customer Patience (on the potentially newly spawned customers too? Or wait one frame?)
      // Let's update all.
      let nextReputation = reputation
      const wordsToRemove: string[] = []

      nextCustomers = nextCustomers.map(c => {
          if (!c) return null
          
          if (c.state !== 'WAITING') {
             const remaining = (c.leaveTimer ?? LEAVE_DURATION) - dt
             if (remaining <= 0) return null // Despawn
             return { ...c, leaveTimer: remaining }
          }
          
           const newPatience = c.patience - dt
           if (newPatience <= 0) {
              nextReputation -= 25
              nextAngryCustomers += 1
              wordsToRemove.push(...c.request.term.split(' '))
              return { ...c, patience: 0, state: 'LEAVING_ANGRY' as const, leaveTimer: LEAVE_DURATION }
           }
           return { ...c, patience: newPatience }
      })
      
      // Simple Reset Logic
      const nextCauldrons = cauldrons.map((cauldron, i) => {
          const customer = nextCustomers[i]
          if (!customer || customer.state === 'LEAVING_ANGRY') {
              if (cauldron.state !== 'IDLE') {
                   return { ...cauldron, state: 'IDLE' as const, targetSentence: null, currentWords: [], shake: false }
              }
          }
          return cauldron
      })

      // --- 3. INGREDIENT SPAWNING ---
      // (After pool updates from customer spawn)
      
      let nextIngredientTimer = timeToNextIngredientSpawn - dt
      if (nextIngredientTimer <= 0) {
          if (nextActiveWordPool.length > 0) {
              const poolIndex = Math.floor(Math.random() * nextActiveWordPool.length)
              const randomWord = nextActiveWordPool[poolIndex]
              
              const types: Ingredient['type'][] = ['potion', 'mushroom', 'mineral', 'herb']
              const randomType = types[Math.floor(Math.random() * types.length)]

              const newItem: Ingredient = {
                  id: Math.random().toString(36).substr(2, 9),
                  word: randomWord,
                  x: screenWidth + 100,
                  y: BELT_Y,
                  type: randomType,
                  width: INGREDIENT_WIDTH,
                  isDragging: false
              }
              
              nextItems.push(newItem)
              nextActiveWordPool.splice(poolIndex, 1)
          }
          nextIngredientTimer = spawnRate / 1000
      }

      // Update activeWordPool with recycled/removed
      if (recycledWords.length > 0) {
          nextActiveWordPool = [...nextActiveWordPool, ...recycledWords]
      }
      if (wordsToRemove.length > 0) {
          wordsToRemove.forEach(word => {
               const idx = nextActiveWordPool.indexOf(word)
               if (idx > -1) nextActiveWordPool.splice(idx, 1)
          })
      }

      // 5. Update Day Time
      const nextDayTime = dayTime + (dt * 0.01) 

      const nextEffects = effects
        .map(effect => ({ ...effect, age: effect.age + dt }))
        .filter(effect => effect.age < effect.duration)
      
      if (nextReputation <= 0) {
           set({ gameState: 'GAME_OVER', reputation: nextReputation, effects: nextEffects, gameTime: nextGameTime, angryCustomers: nextAngryCustomers, totalCustomerSpawns: nextTotalCustomerSpawns })
       } else {
           set({
             conveyorItems: nextItems,
             customers: nextCustomers,
             reputation: nextReputation,
             dayTime: nextDayTime,
             effects: nextEffects,
             activeWordPool: nextActiveWordPool,
             beltSpeed: targetSpeed,
             cauldrons: nextCauldrons,
             timeToNextCustomerSpawn: nextCustomerTimer,
             timeToNextIngredientSpawn: nextIngredientTimer,
             gameTime: nextGameTime,
             angryCustomers: nextAngryCustomers,
             totalCustomerSpawns: nextTotalCustomerSpawns
           })
       }
  },

  handleDropIngredient: (cauldronIndex, ingredientId, dropPosition) => {
    const { cauldrons, conveyorItems, customers } = get()
    const ingredient = conveyorItems.find(i => i.id === ingredientId)
    const cauldron = cauldrons[cauldronIndex]

    if (!ingredient || !cauldron) return

    // Remove from belt
    set({ conveyorItems: conveyorItems.filter(i => i.id !== ingredientId) })

    // If Cauldron is WARNING or COMPLETED, ignore drops (must be emptied first)
    if (cauldron.state === 'WARNING' || cauldron.state === 'COMPLETED') return

    const emitEffect = (type: PotionRushEffectType) => {
      if (!dropPosition) return
      get().spawnEffect(type, dropPosition.x, dropPosition.y)
    }

    emitEffect('SPLASH')

    const nextCauldron = { ...cauldron }
    const { activeWordPool } = get()
    
    // Strict 1:1 Mapping: Cauldron matches Customer[cauldronIndex]
    const targetCustomer = customers[cauldronIndex]

    if (cauldron.state === 'IDLE') {
        // Must match THIS customer's request start
        if (targetCustomer && targetCustomer.state === 'WAITING' && 
            targetCustomer.request.term.split(' ')[0].toLowerCase() === ingredient.word.toLowerCase()) {
            
            nextCauldron.state = 'BREWING'
            nextCauldron.targetSentence = targetCustomer.request
            nextCauldron.currentWords = [ingredient.word]
        } else {
            // Wrong start! (Or no customer in that slot)
            nextCauldron.state = 'WARNING'
            nextCauldron.currentWords = [ingredient.word]
            emitEffect('SMOKE')
        }
    } else if (cauldron.state === 'BREWING' && cauldron.targetSentence) {
        // Check next word
        const targetWords = cauldron.targetSentence.term.split(' ')
        const nextIndex = cauldron.currentWords.length
        
        if (targetWords[nextIndex].toLowerCase() === ingredient.word.toLowerCase()) {
            nextCauldron.currentWords = [...cauldron.currentWords, ingredient.word]
            
            // Check Completion
            if (nextCauldron.currentWords.length === targetWords.length) {
                nextCauldron.state = 'COMPLETED'
            }
        } else {
            // WRONG INGREDIENT!
            nextCauldron.state = 'WARNING'
            nextCauldron.shake = true
            emitEffect('SMOKE')
            set({ activeWordPool: [...activeWordPool, ingredient.word] })
        }
    }

    const nextCauldrons = [...cauldrons]
    nextCauldrons[cauldronIndex] = nextCauldron
    set({ cauldrons: nextCauldrons })
  },

  handleDumpCauldron: (cauldronIndex) => {
      const { cauldrons, activeWordPool } = get()
      const cauldronToDump = cauldrons[cauldronIndex]
      
      const recycledWords = [...cauldronToDump.currentWords]
      const nextActiveWordPool = [...activeWordPool, ...recycledWords]

      const nextCauldrons = [...cauldrons]
      nextCauldrons[cauldronIndex] = {
          id: cauldronIndex,
          state: 'IDLE',
          targetSentence: null,
          currentWords: [],
          shake: false
      }
      set({ 
          cauldrons: nextCauldrons,
          activeWordPool: nextActiveWordPool
      })
  },

  handleServeCustomer: (customerId, cauldronIndex, servePosition) => {
     const { customers, cauldrons, score, activeWordPool, completedSentences } = get()
     const cauldron = cauldrons[cauldronIndex]
     
     if (cauldron.state !== 'COMPLETED') return

     // Strict Index Match
     const customer = customers[cauldronIndex]
     if (!customer || customer.id !== customerId) return

     if (customer.request.term !== cauldron.targetSentence?.term) return

     // Update Customer
     const nextCustomers = [...customers]
     nextCustomers[cauldronIndex] = { ...customer, state: 'LEAVING_HAPPY', leaveTimer: LEAVE_DURATION }

     // Remove words from pool
     const wordsToRemove = customer.request.term.split(' ')
     const nextActiveWordPool = [...activeWordPool]
     wordsToRemove.forEach(word => {
         const idx = nextActiveWordPool.indexOf(word)
         if (idx > -1) nextActiveWordPool.splice(idx, 1)
     })

     // Reset Cauldron
     const nextCauldrons = [...cauldrons]
     nextCauldrons[cauldronIndex] = {
         id: cauldronIndex,
         state: 'IDLE',
         targetSentence: null,
         currentWords: [],
         shake: false
     }

      // SCORING LOGIC
      // Score = Remaining Seconds (Patience)
      const points = Math.floor(customer.patience)
      const newCompletedSentences = completedSentences + 1
      const newScore = score + points
      
      // Update state first
      set({ 
          customers: nextCustomers, 
          cauldrons: nextCauldrons, 
          score: newScore,
          activeWordPool: nextActiveWordPool,
          completedSentences: newCompletedSentences
      })
      
      // Calculate XP based on updated state
      const updatedState = get()
      const xp = calculatePotionRushXP(updatedState)
      set({ totalXpEarned: xp })

     if (servePosition) {
       get().spawnEffect('SUCCESS', servePosition.x, servePosition.y)
     }
  },

  discardIngredient: (ingredientId) => {
    const { conveyorItems } = get()
    set({ conveyorItems: conveyorItems.filter(item => item.id !== ingredientId) })
  },

  setIngredientDragging: (ingredientId, isDragging) => {
    const { conveyorItems } = get()
    set({
      conveyorItems: conveyorItems.map(item =>
        item.id === ingredientId ? { ...item, isDragging } : item
      )
    })
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

}))

export function calculatePotionRushXP(state: PotionRushState): number {
  const { completedSentences, reputation, gameTime, angryCustomers, totalCustomerSpawns } = state
  
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
  
  // Survival bonus: +1 if reputation >= 50%
  if (reputation >= 50) bonus += 1
  
  // Speed bonus: +1 if game completed in under 2 minutes
  if (gameTime < 120) bonus += 1
  
  // Progression bonus: +1 if completed 3+ sentences
  if (completedSentences >= 3) bonus += 1
  
  return Math.min(10, baseXP + bonus)
}
