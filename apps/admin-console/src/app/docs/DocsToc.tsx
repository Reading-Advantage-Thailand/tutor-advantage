"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/locales/th/docs";

export interface TocSection {
  id: string;
  title: string;
  items: { id: string; name: string }[];
}

/**
 * The topic the reader is on: the last topic whose top has scrolled past the
 * sticky top bar (+ a little). Plain anchors work without it; it only marks
 * the current entry (aria-current="location").
 */
function useCurrentTopic(ids: string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 72) + 24;
      let found: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= offset) found = id;
      }
      // At the very bottom the last topics may never reach the top: mark the last one.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) found = ids[ids.length - 1] ?? found;
      setCurrent(found);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ids]);
  return current;
}

function TocList({ sections, current }: { sections: TocSection[]; current: string | null }) {
  return (
    <ol className="flex flex-col gap-3">
      {sections.map((section) => {
        const inSection = current === section.id || section.items.some((item) => item.id === current);
        return (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={current === section.id ? "location" : undefined}
              className={cn(
                "flex min-h-9 items-center rounded-(--radius-ctl) px-2.5 text-sm leading-[1.45] font-semibold text-fg hover:bg-press pointer-coarse:min-h-11",
                inSection && "text-brand-fg",
              )}
            >
              {section.title}
            </a>
            <ol className="mt-0.5 flex flex-col">
              {section.items.map((item) => {
                const active = current === item.id;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={active ? "location" : undefined}
                      className={cn(
                        "relative flex min-h-9 items-center rounded-(--radius-ctl) py-1.5 pr-2.5 pl-5 text-[0.8125rem] leading-[1.45] text-fg-muted hover:bg-press hover:text-fg pointer-coarse:min-h-11",
                        active &&
                          "bg-brand-soft font-semibold text-brand-soft-fg before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-[3px] before:bg-brand-solid hover:bg-brand-soft hover:text-brand-soft-fg",
                      )}
                    >
                      {item.name}
                    </a>
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Docs table of contents (patterns.md A6): a sticky 240px column from 1024px
 * that marks the topic being read, and a collapsed "สารบัญ" card above the
 * article on phones and tablets.
 */
export function DocsToc({ sections, variant }: { sections: TocSection[]; variant: "sticky" | "disclosure" }) {
  const ids = sections.flatMap((section) => [section.id, ...section.items.map((item) => item.id)]);
  // A stable key so the scroll listener is not re-bound on every render.
  const [stableIds] = useState(ids);
  const current = useCurrentTopic(stableIds);

  if (variant === "disclosure") {
    return (
      <nav aria-label={t("docs.contents")} className="lg:hidden">
        <details className="group card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-(--radius-card) px-4 text-[0.9375rem] font-semibold text-fg focus-ring-inset [&::-webkit-details-marker]:hidden">
            {t("docs.contents")}
            <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-fg-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="border-t border-hairline p-2">
            <TocList sections={sections} current={current} />
          </div>
        </details>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("docs.contents")}
      className="sticky top-[calc(var(--topbar-h)+20px)] hidden max-h-[calc(100dvh-var(--topbar-h)-40px)] overflow-y-auto overscroll-contain p-1.5 lg:block"
    >
      <h2 className="px-2.5 pb-2 text-xs leading-normal font-semibold text-fg-subtle">{t("docs.contents")}</h2>
      <TocList sections={sections} current={current} />
    </nav>
  );
}
