import { useState, useCallback, useEffect } from 'react'
import {
  ACCESSIBILITY_KEY,
  createDefaultAccessibilitySettings,
  deserializeAccessibilitySettings,
  serializeAccessibilitySettings,
  type AccessibilitySettings,
} from '../types/accessibility'

function loadFromStorage(): AccessibilitySettings {
  if (typeof window === 'undefined') return createDefaultAccessibilitySettings()
  try {
    const raw = window.localStorage.getItem(ACCESSIBILITY_KEY)
    if (!raw) return createDefaultAccessibilitySettings()
    return deserializeAccessibilitySettings(raw)
  } catch {
    return createDefaultAccessibilitySettings()
  }
}

function saveToStorage(settings: AccessibilitySettings): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    ACCESSIBILITY_KEY,
    serializeAccessibilitySettings(settings)
  )
}

export function useAccessibilitySettings() {
  const [settings, setSettings] = useState<AccessibilitySettings>(() =>
    loadFromStorage()
  )

  useEffect(() => {
    saveToStorage(settings)
  }, [settings])

  const updateSettings = useCallback(
    (updates: Partial<AccessibilitySettings>) => {
      setSettings((prev) => ({ ...prev, ...updates }))
    },
    []
  )

  const resetSettings = useCallback(() => {
    setSettings(createDefaultAccessibilitySettings())
  }, [])

  const getEffectiveTextSize = useCallback(
    (baseSize: number): number => {
      return Math.round(baseSize * settings.textSizeMultiplier)
    },
    [settings.textSizeMultiplier]
  )

  const getEffectiveTouchTarget = useCallback(
    (baseSize: number): number => {
      return Math.round(baseSize * settings.touchTargetMultiplier)
    },
    [settings.touchTargetMultiplier]
  )

  return {
    settings,
    updateSettings,
    resetSettings,
    getEffectiveTextSize,
    getEffectiveTouchTarget,
  }
}
