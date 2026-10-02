"use client";

import Link from "next/link";
import { Maximize, Minimize, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ShellProvider, useShell } from "./ShellContext";
import { ThemeToggle } from "./ThemeToggle";
import { Toaster } from "./Toast";

const ACTIONS_SLOT_ID = "lesson-bar-actions";

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen));
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  return { isFullscreen, supported, toggle };
}

function LessonBar({ exitHref, exitLabel }: { exitHref: string; exitLabel: string }) {
  const { title } = useShell();
  const { isFullscreen, supported, toggle } = useFullscreen();
  return (
    <header className="lesson-bar">
      <Link
        href={exitHref}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-fg-muted hover:bg-press hover:text-fg"
      >
        <X aria-hidden="true" className="size-5" />
        <span className="hidden sm:inline">{exitLabel}</span>
        <span className="sr-only sm:hidden">{exitLabel}</span>
      </Link>
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-hairline" />
      <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-fg">{title ?? t("shell.lessonMode")}</p>
      <div id={ACTIONS_SLOT_ID} className="flex shrink-0 items-center gap-1.5" />
      {supported ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={isFullscreen ? t("shell.exitFullscreen") : t("shell.enterFullscreen")}
          title={isFullscreen ? t("shell.exitFullscreen") : t("shell.enterFullscreen")}
          className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-press hover:text-fg md:inline-flex"
        >
          {isFullscreen ? <Minimize aria-hidden="true" className="size-[18px]" /> : <Maximize aria-hidden="true" className="size-[18px]" />}
        </button>
      ) : null}
      <ThemeToggle />
    </header>
  );
}

export interface LessonShellProps {
  /** Where the exit (×) control goes, e.g. `/dashboard/classes/${classId}`. */
  exitHref: string;
  exitLabel?: string;
  children: ReactNode;
}

/**
 * Focused full-screen shell for /lesson/[id]/*: no sidebar or tab bar, a slim
 * top bar (exit · title · page actions · fullscreen · theme) and a stage that
 * fills the rest of the viewport (`--lesson-viewport-h`). Pages register the
 * bar title with <PageHeader>/useShellTitle and can add buttons with
 * <LessonBarActions>. The bar slims to 44px on short screens (≤800px tall,
 * e.g. 1280×720 / 1366×768 projectors) and hides in browser fullscreen.
 */
export function LessonShell({ exitHref, exitLabel = t("shell.exitLesson"), children }: LessonShellProps) {
  return (
    <ShellProvider user={null}>
      <div className="lesson-shell">
        <LessonBar exitHref={exitHref} exitLabel={exitLabel} />
        <main id="main-content" className="lesson-stage">
          {children}
        </main>
        <Toaster />
      </div>
    </ShellProvider>
  );
}

/** Renders its children into the lesson bar (right side), e.g. a "Start" button. */
export function LessonBarActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(ACTIONS_SLOT_ID));
  }, []);
  return slot ? createPortal(children, slot) : null;
}

/**
 * Bottom control dock for lesson pages: sticks to the bottom edge of the
 * viewport so primary controls stay visible on 720px-tall projectors.
 */
export function LessonDock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("lesson-dock flex items-center gap-2", className)}>{children}</div>;
}

/**
 * Centred, padded content column for non-presenter lesson pages (hub, select,
 * prepare). Presenter/live pages render full-bleed without it.
 */
export function LessonContent({
  width = "default",
  className,
  children,
}: {
  /** narrow 768 · default 1024 · wide 1280 */
  width?: "narrow" | "default" | "wide";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 pt-5 pb-10 md:px-6 md:pt-8",
        width === "narrow" && "max-w-3xl",
        width === "default" && "max-w-5xl",
        width === "wide" && "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
