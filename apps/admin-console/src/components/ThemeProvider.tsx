"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light/dark via the `dark` class; follows the OS by default (was forced dark). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
