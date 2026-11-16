"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * DataTable's scroll frame (components.md §11): the table scrolls sideways
 * inside its card, with edge shadows (globals.css .ds-table-edge, driven by
 * the scroll position) while there is more to see. The shadows show only
 * while the frame has data-overflow, which a ResizeObserver keeps in step with
 * the scroller and the table: a table that stops overflowing (window widened,
 * side nav collapsed, a column hidden) does not keep a shadow from its last
 * scroll position. The start shadow begins after a sticky first column.
 * Before hydration or without ResizeObserver there are no shadows; the
 * scrollbar still shows.
 *
 * When the table overflows and holds nothing focusable, the browser makes the
 * scroller a Tab stop; its focus ring is drawn on the table card
 * (globals.css, "tables owner" block), where neither the sticky header nor the
 * card's rounded clip can hide it.
 */
export function TableScrollFrame({
  children,
  className,
  scrollClassName,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Extra classes for the scroller (opacity while loading, scroll padding). */
  scrollClassName?: string;
  /** Scroller style (e.g. a max height for vertical scrolling). */
  style?: CSSProperties;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const scroller = scrollRef.current;
    if (!frame || !scroller || typeof ResizeObserver === "undefined") return;
    const update = () => {
      frame.toggleAttribute("data-overflow", scroller.scrollWidth > scroller.clientWidth + 1);
      const sticky = scroller.querySelector<HTMLElement>("thead [data-sticky-col]");
      frame.style.setProperty("--table-edge-start", `${sticky ? sticky.offsetWidth : 0}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    update();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={cn("ds-table-frame", className)}>
      <div ref={scrollRef} className={cn("ds-table-scroll overflow-x-auto", scrollClassName)} style={style}>
        {children}
      </div>
      <span aria-hidden="true" className="ds-table-edge" data-edge="start" />
      <span aria-hidden="true" className="ds-table-edge" data-edge="end" />
    </div>
  );
}
