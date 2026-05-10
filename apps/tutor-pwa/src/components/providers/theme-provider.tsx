"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

import { useEffect } from "react";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const initGlobalAudio = () => {
      try {
        const win = window as any;
        if (!win.__globalAudioCtx) {
          const AudioCtx = win.AudioContext || win.webkitAudioContext;
          if (AudioCtx) win.__globalAudioCtx = new AudioCtx();
        }
        if (win.__globalAudioCtx && win.__globalAudioCtx.state === "suspended") {
          win.__globalAudioCtx.resume().catch(() => {});
        }
      } catch (e) {}
    };

    window.addEventListener("click", initGlobalAudio, { capture: true });
    window.addEventListener("touchstart", initGlobalAudio, { capture: true });
    window.addEventListener("mousedown", initGlobalAudio, { capture: true });

    return () => {
      window.removeEventListener("click", initGlobalAudio, { capture: true });
      window.removeEventListener("touchstart", initGlobalAudio, { capture: true });
      window.removeEventListener("mousedown", initGlobalAudio, { capture: true });
    };
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
