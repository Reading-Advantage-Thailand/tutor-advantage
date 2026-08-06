export interface AccessibilitySettings {
  textSizeMultiplier: number
  touchTargetMultiplier: number
  assistMode: boolean
  reduceMotion: boolean
}

export const ACCESSIBILITY_KEY = 'advantage-games-accessibility'

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  textSizeMultiplier: 1.0,
  touchTargetMultiplier: 1.0,
  assistMode: false,
  reduceMotion: false,
}

export function createDefaultAccessibilitySettings(): AccessibilitySettings {
  return { ...DEFAULT_ACCESSIBILITY_SETTINGS }
}

export function serializeAccessibilitySettings(
  settings: AccessibilitySettings
): string {
  return JSON.stringify(settings)
}

export function deserializeAccessibilitySettings(
  json: string
): AccessibilitySettings {
  try {
    const parsed = JSON.parse(json)
    return {
      textSizeMultiplier:
        typeof parsed.textSizeMultiplier === 'number'
          ? parsed.textSizeMultiplier
          : DEFAULT_ACCESSIBILITY_SETTINGS.textSizeMultiplier,
      touchTargetMultiplier:
        typeof parsed.touchTargetMultiplier === 'number'
          ? parsed.touchTargetMultiplier
          : DEFAULT_ACCESSIBILITY_SETTINGS.touchTargetMultiplier,
      assistMode:
        typeof parsed.assistMode === 'boolean'
          ? parsed.assistMode
          : DEFAULT_ACCESSIBILITY_SETTINGS.assistMode,
      reduceMotion:
        typeof parsed.reduceMotion === 'boolean'
          ? parsed.reduceMotion
          : DEFAULT_ACCESSIBILITY_SETTINGS.reduceMotion,
    }
  } catch {
    return createDefaultAccessibilitySettings()
  }
}
