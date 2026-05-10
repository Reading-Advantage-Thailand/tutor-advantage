/**
 * Sound Effects utility for Interactive Lesson — Student side.
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
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  } catch (e) {}
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
        } catch (e) {}
        break;
    }
  } catch {
    // Silently fail
  }
}
