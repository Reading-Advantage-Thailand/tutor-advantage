'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export type GameSoundType =
  | 'success'
  | 'error'
  | 'missile-hit'
  | 'bubbling'
  | 'clinking'
  | 'angry-grunt'
  | 'cash-register'

/** One press can reach the hook several times in a few frames; only the first is heard. */
const REPEAT_GAP_MS = 90
/** A sound asked for while audio is still locked is dropped if the unlock comes later than this. */
const STALE_AFTER_MS = 250
const MASTER_VOLUME = 0.9

let sharedContext: AudioContext | null = null
let sharedOutput: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
const lastPlayedAt = new Map<GameSoundType, number>()

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContextClass()
    sharedOutput = sharedContext.createGain()
    sharedOutput.gain.value = MASTER_VOLUME
    sharedOutput.connect(sharedContext.destination)
    noiseBuffer = null
  }
  return sharedContext
}

type Tone = {
  wave: OscillatorType
  freq: number
  endFreq?: number
  /** Seconds after the sound starts. */
  at: number
  dur: number
  peak: number
  /** Soften a buzzy wave so it stays pleasant on a phone speaker. */
  lowpassHz?: number
}

function playTone(ctx: AudioContext, out: AudioNode, start: number, tone: Tone) {
  const at = start + tone.at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = tone.wave
  osc.frequency.setValueAtTime(tone.freq, at)
  if (tone.endFreq) osc.frequency.exponentialRampToValueAtTime(tone.endFreq, at + tone.dur)
  // Quick fade in and out: starting at full volume clicks on phone speakers.
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(tone.peak, at + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.dur)
  osc.connect(gain)
  if (tone.lowpassHz) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(tone.lowpassHz, at)
    gain.connect(filter)
    filter.connect(out)
  } else {
    gain.connect(out)
  }
  osc.start(at)
  osc.stop(at + tone.dur + 0.02)
}

function playNoiseBurst(ctx: AudioContext, out: AudioNode, start: number, dur: number, peak: number) {
  if (!noiseBuffer) {
    const length = Math.floor(ctx.sampleRate * 0.4)
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const samples = noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  source.buffer = noiseBuffer
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1400, start)
  filter.frequency.exponentialRampToValueAtTime(200, start + dur)
  gain.gain.setValueAtTime(peak, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  source.start(start)
  source.stop(start + dur + 0.02)
}

/** The synthesized sounds. There are no audio files: the games need no download for sound. */
function renderSound(ctx: AudioContext, out: AudioNode, type: GameSoundType, start: number) {
  const tones: Tone[] = []
  switch (type) {
    case 'success':
      // Three rising notes.
      tones.push(
        { wave: 'triangle', freq: 1047, at: 0, dur: 0.14, peak: 0.34 },
        { wave: 'triangle', freq: 1319, at: 0.07, dur: 0.14, peak: 0.34 },
        { wave: 'triangle', freq: 1568, at: 0.14, dur: 0.26, peak: 0.38 },
      )
      break
    case 'error':
      // A soft falling "uh-oh": clearly wrong, never a harsh buzzer for a child.
      tones.push(
        { wave: 'triangle', freq: 370, endFreq: 330, at: 0, dur: 0.14, peak: 0.42 },
        { wave: 'triangle', freq: 277, endFreq: 220, at: 0.13, dur: 0.24, peak: 0.42 },
      )
      break
    case 'missile-hit':
      playNoiseBurst(ctx, out, start, 0.2, 0.42)
      tones.push({ wave: 'sine', freq: 150, endFreq: 50, at: 0, dur: 0.24, peak: 0.5 })
      break
    case 'bubbling':
      tones.push(
        { wave: 'sine', freq: 320, endFreq: 560, at: 0, dur: 0.07, peak: 0.2 },
        { wave: 'sine', freq: 410, endFreq: 690, at: 0.06, dur: 0.07, peak: 0.18 },
        { wave: 'sine', freq: 280, endFreq: 500, at: 0.13, dur: 0.08, peak: 0.2 },
      )
      break
    case 'clinking':
      tones.push(
        { wave: 'sine', freq: 2093, at: 0, dur: 0.09, peak: 0.16 },
        { wave: 'sine', freq: 3136, at: 0.045, dur: 0.11, peak: 0.13 },
      )
      break
    case 'angry-grunt':
      tones.push(
        { wave: 'sawtooth', freq: 170, endFreq: 95, at: 0, dur: 0.14, peak: 0.34, lowpassHz: 800 },
        { wave: 'sawtooth', freq: 130, endFreq: 70, at: 0.11, dur: 0.2, peak: 0.34, lowpassHz: 700 },
      )
      break
    case 'cash-register':
      // "Ka-ching": two short strikes and a bright ring.
      tones.push(
        { wave: 'square', freq: 1319, at: 0, dur: 0.05, peak: 0.1 },
        { wave: 'square', freq: 1760, at: 0.06, dur: 0.05, peak: 0.1 },
        { wave: 'sine', freq: 2637, at: 0.12, dur: 0.34, peak: 0.28 },
      )
      break
  }
  tones.forEach((tone) => playTone(ctx, out, start, tone))
}

/** Plays one game sound. Safe to call anywhere; it never throws and never touches the network. */
export function playGameSound(type: GameSoundType) {
  try {
    const now = Date.now()
    const last = lastPlayedAt.get(type)
    if (last !== undefined && now - last < REPEAT_GAP_MS) return
    lastPlayedAt.set(type, now)

    const ctx = getContext()
    if (!ctx || !sharedOutput) return
    const output = sharedOutput

    if (ctx.state === 'running') {
      renderSound(ctx, output, type, ctx.currentTime)
      return
    }
    // Still locked by the browser. Sounds scheduled now would all fire together
    // on the first tap, so play only if the unlock comes straight away.
    void ctx.resume().then(() => {
      if (Date.now() - now <= STALE_AFTER_MS) renderSound(ctx, output, type, ctx.currentTime)
    }, () => undefined)
  } catch (e) {
    console.warn('Game sound failed', e)
  }
}

let unlockInstalled = false

/** Browsers start audio locked until a tap, and a game may mount with no tap of its own. */
function installAudioUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const events = ['pointerdown', 'touchend', 'keydown'] as const
  const unlock = () => {
    try {
      const ctx = getContext()
      if (!ctx) return
      void ctx.resume().then(() => {
        events.forEach((name) => window.removeEventListener(name, unlock, true))
      }, () => undefined)
    } catch {
      // No audio on this device: the games play silently.
    }
  }
  events.forEach((name) => window.addEventListener(name, unlock, { capture: true, passive: true }))
}

export function useSound() {
  useEffect(() => {
    installAudioUnlock()
  }, [])

  return { playSound: playGameSound }
}
