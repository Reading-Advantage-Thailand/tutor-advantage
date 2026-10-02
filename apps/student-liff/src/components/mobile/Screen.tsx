import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** Rendered element; default "main". Use "div" when nesting inside another <main>. */
  as?: "main" | "div" | "section";
}

/**
 * Page wrapper: full-height flex column on the app background with an
 * opacity-only enter animation (safe for position:fixed children). Its height
 * already accounts for the TabBar on tab roots. Server-compatible.
 *
 * Layout convention: put <AppBar>/<PageHeader> first, then content in a
 * `px-4` (16px gutter) container, then an optional <BottomActionBar> last.
 */
export function Screen({ children, className, as: Component = "main" }: ScreenProps) {
  return <Component className={cn("screen", className)}>{children}</Component>;
}
