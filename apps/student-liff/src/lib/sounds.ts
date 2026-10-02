/**
 * Sound Effects utility for Interactive Lesson - Student side.
 * Uses the Web Audio API to generate lightweight synth sounds.
 */

type SoundName =
  | 'select'
  | 'submit'
  | 'correct'
  | 'incorrect'
  | 'celebration'
  | 'phaseChange'
  | 'nudged'
  | 'ready'
  | 'notification';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error("Web Audio API is not supported");
    }
    audioCtx = new AudioContextConstructor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {}); // Silently attempt recovery
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

/** localStorage key for the student's "mute notification sounds" setting. */
export const NOTIFICATION_MUTE_KEY = 'app-notif-muted';

/** True when the student muted notification sounds (Notifications settings). */
export function isNotificationSoundMuted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(NOTIFICATION_MUTE_KEY) === 'true';
  } catch {
    return false; // storage blocked (private mode): fall back to sound on
  }
}

/** Persist the mute setting read by playNotificationSound(). */
export function setNotificationSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTIFICATION_MUTE_KEY, String(muted));
  } catch {
    // storage blocked: the setting simply won't persist
  }
}

/**
 * Play the new-message/notification chime unless the student muted it.
 * Safe to call anywhere: never throws, no-op on the server or without Web Audio.
 */
export function playNotificationSound(): void {
  try {
    if (isNotificationSoundMuted()) return;
    playSound('notification');
  } catch {
    // Sound is best-effort.
  }
}

export function playSound(name: SoundName): void {
  if (typeof window === 'undefined') return;

  try {
    switch (name) {
      case 'select':
        playTone(700, 0.05, 'sine', 0.15);
        break;
      case 'submit':
        playTone(880, 0.08, 'sine', 0.2);
        setTimeout(() => playTone(1100, 0.12, 'sine', 0.15), 60);
        break;
      case 'correct':
        playTone(523.25, 0.12, 'sine', 0.2);
        setTimeout(() => playTone(659.25, 0.12, 'sine', 0.2), 80);
        setTimeout(() => playTone(783.99, 0.25, 'sine', 0.25), 160);
        break;
      case 'incorrect':
        playTone(400, 0.15, 'triangle', 0.2);
        setTimeout(() => playTone(320, 0.25, 'triangle', 0.2), 120);
        break;
      case 'celebration':
        playTone(523.25, 0.15, 'sine', 0.15);
        setTimeout(() => playTone(659.25, 0.15, 'sine', 0.15), 100);
        setTimeout(() => playTone(783.99, 0.15, 'sine', 0.15), 200);
        setTimeout(() => playTone(1046.5, 0.3, 'sine', 0.2), 300);
        break;
      case 'phaseChange':
        playTone(523.25, 0.15, 'sine', 0.2);
        setTimeout(() => playTone(659.25, 0.25, 'sine', 0.2), 100);
        break;
      case 'nudged':
        playTone(1000, 0.08, 'square', 0.2);
        setTimeout(() => playTone(1200, 0.08, 'square', 0.2), 120);
        setTimeout(() => playTone(1000, 0.08, 'square', 0.2), 240);
        break;
      case 'ready':
        playTone(1046.5, 0.15, 'sine', 0.2);
        break;
      case 'notification':
        try {
          const ctx = getAudioContext();
          if (ctx.state === 'running' || ctx.state === 'suspended') {
             const osc1 = ctx.createOscillator();
             const osc2 = ctx.createOscillator();
             const gain = ctx.createGain();
             osc1.type = "sine";
             osc2.type = "sine";
             osc1.frequency.setValueAtTime(880, ctx.currentTime);
             osc2.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
             gain.gain.setValueAtTime(0, ctx.currentTime);
             gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02); 
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
             osc1.connect(gain);
             osc2.connect(gain);
             gain.connect(ctx.destination);
             osc1.start(ctx.currentTime);
             osc2.start(ctx.currentTime + 0.1);
             osc1.stop(ctx.currentTime + 0.6);
             osc2.stop(ctx.currentTime + 0.6);
          }
        } catch {}
        break;
    }
  } catch {
    // Silently fail
  }
}
