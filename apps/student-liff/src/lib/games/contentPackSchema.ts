import type { VocabularyItem } from '@/store/useGameStore'

export const VOCABULARY_ITEM_REQUIRED_FIELDS = ['term', 'translation'] as const

export const CONTENT_PACK_REQUIRED_FIELDS = ['packId', 'version', 'items'] as const

export const CONTENT_PACK_OPTIONAL_FIELDS = [
  'name',
  'description',
  'gameType',
  'difficulty',
  'active',
  'language',
  'createdAt',
  'updatedAt',
  'tags',
  'author',
] as const

export const VALID_DIFFICULTIES = ['easy', 'normal', 'hard', 'extreme'] as const
export const VALID_GAME_TYPES = ['vocabulary', 'sentence'] as const

export type PackFormat = 'v1-legacy' | 'v2'

export interface ContentPackMetadata {
  packId: string
  version: string
  items: VocabularyItem[]
  name?: string
  description?: string
  gameType?: 'vocabulary' | 'sentence'
  difficulty?: 'easy' | 'normal' | 'hard' | 'extreme'
  active?: boolean
  language?: string
  createdAt?: string
  updatedAt?: string
  tags?: string[]
  author?: string
  [key: string]: unknown
}

export interface ContentPackValidationError {
  code: string
  message: string
  field?: string
  value?: unknown
  fix?: string
}

export interface ContentPackValidationResult {
  isValid: boolean
  format: PackFormat | null
  metadata: ContentPackMetadata | null
  errors: string[]
  warnings?: string[]
}

function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version)
}

export function detectPackFormat(pack: unknown): PackFormat | null {
  if (pack === null || pack === undefined) {
    return null
  }

  if (typeof pack !== 'object') {
    return null
  }

  if (Array.isArray(pack)) {
    return 'v1-legacy'
  }

  const obj = pack as Record<string, unknown>
  if (obj.packId !== undefined && obj.version !== undefined && obj.items !== undefined) {
    return 'v2'
  }

  return null
}

export function validateVocabularyItem(
  item: VocabularyItem
): string[] {
  const errors: string[] = []

  if (item.term === undefined || item.term === null) {
    errors.push('Vocabulary item missing required field: term')
  } else if (typeof item.term !== 'string') {
    errors.push(`Vocabulary item field "term" must be a string, got ${typeof item.term}`)
  } else if (item.term.trim() === '') {
    errors.push('Vocabulary item field "term" cannot be empty')
  }

  if (item.translation === undefined || item.translation === null) {
    errors.push('Vocabulary item missing required field: translation')
  } else if (typeof item.translation !== 'string') {
    errors.push(`Vocabulary item field "translation" must be a string, got ${typeof item.translation}`)
  } else if (item.translation.trim() === '') {
    errors.push('Vocabulary item field "translation" cannot be empty')
  }

  return errors
}

export function validateContentPackMetadata(
  pack: ContentPackMetadata
): string[] {
  const errors: string[] = []

  if (!pack.packId) {
    errors.push('Content pack missing required field: packId')
  }

  if (!pack.version) {
    errors.push('Content pack missing required field: version')
  } else if (!isValidSemver(pack.version)) {
    errors.push(`Content pack version must be valid semver (e.g., 1.0.0), got "${pack.version}"`)
  }

  if (pack.items === undefined) {
    errors.push('Content pack missing required field: items')
  } else if (!Array.isArray(pack.items)) {
    errors.push(`Content pack field "items" must be an array, got ${typeof pack.items}`)
  } else if (pack.items.length === 0) {
    errors.push('Content pack items array cannot be empty')
  }

  if (pack.difficulty !== undefined) {
    if (typeof pack.difficulty !== 'string' || !VALID_DIFFICULTIES.includes(pack.difficulty as typeof VALID_DIFFICULTIES[number])) {
      errors.push('Content pack difficulty must be one of: easy, normal, hard, extreme')
    }
  }

  if (pack.gameType !== undefined) {
    if (typeof pack.gameType !== 'string' || !VALID_GAME_TYPES.includes(pack.gameType as typeof VALID_GAME_TYPES[number])) {
      errors.push('Content pack gameType must be one of: vocabulary, sentence')
    }
  }

  const allFields = [...CONTENT_PACK_REQUIRED_FIELDS, ...CONTENT_PACK_OPTIONAL_FIELDS]
  const knownFields = new Set<string>(allFields)
  for (const key of Object.keys(pack)) {
    if (!knownFields.has(key)) {
      errors.push(`Content pack has unknown field: ${key}`)
    }
  }

  return errors
}

function generatePackId(): string {
  return `legacy-pack-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`
}

export function validateContentPack(
  pack: unknown
): ContentPackValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const format = detectPackFormat(pack)

  if (format === null) {
    return {
      isValid: false,
      format: null,
      metadata: null,
      errors: ['Unrecognized content pack format: ' + (pack === null ? 'null' : typeof pack)],
    }
  }

  if (format === 'v1-legacy') {
    const items = pack as VocabularyItem[]

    if (items.length === 0) {
      errors.push('Content pack is empty')
      return {
        isValid: false,
        format: 'v1-legacy',
        metadata: null,
        errors,
      }
    }

    for (let i = 0; i < items.length; i++) {
      const itemErrors = validateVocabularyItem(items[i])
      for (const err of itemErrors) {
        errors.push(`Item ${i}: ${err}`)
      }
    }

    if (items.length < 5) {
      errors.push(`Content pack must have at least 5 items for gameplay, found ${items.length}. Fix: Add more vocabulary items to reach minimum of 5.`)
    }

    const metadata: ContentPackMetadata = {
      packId: generatePackId(),
      version: '1.0.0',
      items,
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        format: 'v1-legacy',
        metadata,
        errors,
        warnings,
      }
    }

    warnings.push('Legacy v1 pack format detected. Consider migrating to v2 format for additional features (versioning, metadata, active flag).')

    return {
      isValid: true,
      format: 'v1-legacy',
      metadata,
      errors: [],
      warnings,
    }
  }

  // v2 format
  const metadata = pack as ContentPackMetadata

  const metadataErrors = validateContentPackMetadata(metadata)
  errors.push(...metadataErrors)

  if (metadata.items) {
    for (let i = 0; i < metadata.items.length; i++) {
      const itemErrors = validateVocabularyItem(metadata.items[i])
      for (const err of itemErrors) {
        errors.push(`Item ${i}: ${err}`)
      }
    }
  }

  if (metadata.items && metadata.items.length < 5) {
    errors.push(`Content pack must have at least 5 items for gameplay, found ${metadata.items.length}. Action: Add more vocabulary items to reach minimum of 5.`)
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      format: 'v2',
      metadata,
      errors,
      warnings,
    }
  }

  return {
    isValid: true,
    format: 'v2',
    metadata,
    errors: [],
    warnings,
  }
}
