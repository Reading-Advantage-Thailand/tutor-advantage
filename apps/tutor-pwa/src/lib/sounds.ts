/**
 * Sound Effects utility for Interactive Lesson phases.
 * Uses the Web Audio API to generate lightweight synth sounds.
 * No external audio files needed.
 */

type SoundName =
  | 'phaseChange'
  | 'countdown'
  | 'correct'
  | 'incorrect'
  | 'submit'
  | 'nudge'
  | 'celebration'
  | 'ready'
  | 'tick';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
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
}

function playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  frequencies.forEach((f) => playTone(f, duration, type, volume));
}

export function playSound(name: SoundName): void {
  if (typeof window === 'undefined') return;

  try {
    switch (name) {
      case 'phaseChange':
        // Rising two-tone chime
        playTone(523.25, 0.15, 'sine', 0.25); // C5
        setTimeout(() => playTone(659.25, 0.3, 'sine', 0.25), 100); // E5
        break;

      case 'countdown':
        // Short tick
        playTone(800, 0.08, 'square', 0.15);
        break;

      case 'correct':
        // Happy ascending arpeggio
        playTone(523.25, 0.12, 'sine', 0.2); // C5
        setTimeout(() => playTone(659.25, 0.12, 'sine', 0.2), 80); // E5
        setTimeout(() => playTone(783.99, 0.25, 'sine', 0.25), 160); // G5
        break;

      case 'incorrect':
        // Descending minor tone
        playTone(400, 0.15, 'triangle', 0.2);
        setTimeout(() => playTone(320, 0.25, 'triangle', 0.2), 120);
        break;

      case 'submit':
        // Soft confirmation blip
        playTone(880, 0.08, 'sine', 0.2);
        setTimeout(() => playTone(1100, 0.12, 'sine', 0.15), 60);
        break;

      case 'nudge':
        // Attention-grabbing double beep
        playTone(1000, 0.08, 'square', 0.15);
        setTimeout(() => playTone(1200, 0.08, 'square', 0.15), 120);
        break;

      case 'celebration':
        // Triumphant chord progression
        playChord([523.25, 659.25, 783.99], 0.3, 'sine', 0.12); // C major
        setTimeout(() => playChord([587.33, 739.99, 880], 0.4, 'sine', 0.15), 250); // D major
        setTimeout(() => playChord([659.25, 830.61, 987.77], 0.5, 'sine', 0.15), 500); // E major
        break;

      case 'ready':
        // Single bright ping
        playTone(1046.5, 0.15, 'sine', 0.2);
        break;

      case 'tick':
        // Very subtle tick
        playTone(600, 0.04, 'sine', 0.1);
        break;
    }
  } catch {
    // Silently fail - audio is enhancement only
  }
}
