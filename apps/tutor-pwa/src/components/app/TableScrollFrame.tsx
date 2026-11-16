"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * DataTable's scroll frame (components.md §11): the table scrolls sideways
 * inside its card, with edge shadows (globals.css .ds-table-edge, driven by
 * the scroll position) while there is more to see. The shadows show only
 * while the frame has data-overflow, which a ResizeObserver keeps in step with
 * the scroller and the table: a table that stops overflowing (window widened,
 * side nav collapsed) does not keep a shadow from its last scroll position.
 * Before hydration or without ResizeObserver there are no shadows; the
 * scrollbar still shows.
 */
export function TableScrollFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const scroller = scrollRef.current;
    if (!frame || !scroller || typeof ResizeObserver === "undefined") return;
    const update = () => frame.toggleAttribute("data-overflow", scroller.scrollWidth > scroller.clientWidth + 1);
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    update();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="ds-table-frame">
      <div ref={scrollRef} className="ds-table-scroll overflow-x-auto">
        {children}
      </div>
      <span aria-hidden="true" className="ds-table-edge" data-edge="start" />
      <span aria-hidden="true" className="ds-table-edge" data-edge="end" />
    </div>
  );
}
