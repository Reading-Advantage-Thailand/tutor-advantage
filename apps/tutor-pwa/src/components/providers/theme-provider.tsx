"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

import { useEffect } from "react";

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  __globalAudioCtx?: AudioContext;
};

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const initGlobalAudio = (event: Event) => {
      try {
        const win = window as AudioWindow;
        if (!event.isTrusted || win.__globalAudioCtx) return;

        if (!win.__globalAudioCtx) {
          const AudioCtx = win.AudioContext || win.webkitAudioContext;
          if (AudioCtx) win.__globalAudioCtx = new AudioCtx();
        }
      } catch {}
    };

    window.addEventListener("pointerdown", initGlobalAudio, { capture: true });
    window.addEventListener("keydown", initGlobalAudio, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", initGlobalAudio, { capture: true });
      window.removeEventListener("keydown", initGlobalAudio, { capture: true });
    };
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
