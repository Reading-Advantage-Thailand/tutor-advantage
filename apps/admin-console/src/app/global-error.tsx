"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { notoThai } from "./fonts";
import "./globals.css";

/**
 * Last-resort boundary (root layout failed): no providers and no shell
 * components (they may be what failed), only the stylesheet, the font, the
 * button classes and two icons.
 * The same status card as the route error pages, in plain markup; the theme
 * is read the way next-themes stores it (localStorage "theme", else the OS).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("theme");
      const dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // storage blocked: stay light
    }
  }, []);

  return (
    <html lang="th" className={notoThai.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-app text-fg antialiased">
        <main className="flex min-h-dvh items-center justify-center px-4 py-10">
          <section
            role="alert"
            aria-labelledby="global-error-title"
            className="card flex w-full max-w-md flex-col items-center px-6 pt-8 pb-7 text-center sm:px-8 sm:pt-10 sm:pb-8"
          >
            <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-(--radius-tile) bg-tile-red text-icon-red">
              <AlertTriangle className="size-6" />
            </span>
            <h1 id="global-error-title" className="mt-4 text-xl leading-[1.4] font-semibold text-fg sm:text-2xl sm:leading-[1.35]">
              เกิดข้อผิดพลาด
            </h1>
            <p className="mt-1.5 max-w-sm text-base text-balance text-fg-muted lg:text-sm">ไม่สามารถแสดงหน้านี้ได้ กรุณาลองใหม่อีกครั้ง</p>
            <button
              type="button"
              onClick={reset}
              className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}
            >
              <RotateCw aria-hidden="true" />
              ลองใหม่
            </button>
            {error.digest ? (
              <p className="mt-4 max-w-full text-xs text-fg-subtle">
                รหัสอ้างอิง: <span className="font-mono break-all select-all">{error.digest}</span>
              </p>
            ) : null}
          </section>
        </main>
      </body>
    </html>
  );
}
