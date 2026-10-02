"use client";

import React from "react";

/** Scales its content down (never up) so a phase fits the fullscreen stage. */
export function FitToViewport({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = window.requestAnimationFrame(() => {
        const frameEl = frameRef.current;
        const contentEl = contentRef.current;
        if (!frameEl || !contentEl) return;

        const availableWidth = frameEl.clientWidth;
        const availableHeight = frameEl.clientHeight;
        const contentWidth = contentEl.scrollWidth;
        const contentHeight = contentEl.scrollHeight;

        if (
          !availableWidth ||
          !availableHeight ||
          !contentWidth ||
          !contentHeight
        ) {
          setScale(1);
          return;
        }

        setScale(
          Math.min(
            1,
            availableWidth / contentWidth,
            availableHeight / contentHeight,
          ),
        );
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (frameRef.current) observer.observe(frameRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled]);

  return (
    <div
      ref={frameRef}
      className={`flex h-full min-h-0 flex-1 flex-col ${enabled ? "overflow-hidden" : "overflow-visible"}`}
    >
      <div
        ref={contentRef}
        className="flex h-full min-h-0 w-full flex-1 flex-col"
        style={{
          transform: enabled ? `scale(${scale})` : undefined,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
