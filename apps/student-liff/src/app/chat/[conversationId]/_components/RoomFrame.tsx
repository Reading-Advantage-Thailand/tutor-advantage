import { forwardRef, type ReactNode } from "react";
import { Screen } from "@/components/mobile";
import { cn } from "@/lib/utils";

/**
 * Full-screen chat room shell. Fixed to the VISIBLE viewport: `--vv-top` /
 * `--vvh` are kept in sync with window.visualViewport by the live room (see
 * useVisualViewportVars), so the header stays on screen and the composer sits
 * right above the on-screen keyboard. Without them it falls back to 100dvh.
 * Centred on the app column like the rest of the app.
 */
export const RoomFrame = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(function RoomFrame(
  { children, className },
  ref,
) {
  return (
    <Screen>
      <div
        ref={ref}
        className={cn(
          "group/room fixed inset-x-0 top-[var(--vv-top,0px)] mx-auto flex h-[var(--vvh,100dvh)] w-full max-w-[var(--max-mobile)] flex-col overflow-hidden bg-app",
          className,
        )}
      >
        {children}
      </div>
    </Screen>
  );
});
