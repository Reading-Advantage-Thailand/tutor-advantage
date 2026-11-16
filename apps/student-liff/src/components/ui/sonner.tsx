"use client"

import { isValidElement, useEffect, type ReactNode } from "react"
// Relative imports on purpose: the root vitest config maps "@" to tutor-pwa (sonner.test.ts).
import { useTheme } from "../providers/ThemeProvider"
import { thaiCopy } from "../../lib/thaiText"
import { Toaster as Sonner, toast, type ExternalToast, type ToasterProps } from "sonner"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"

/**
 * Toast text goes through the Thai line-break helper (patterns.md "Thai text").
 * Sonner draws the message itself and has no hook to format it, and the app
 * raises its toasts with plain strings (toast.error(t("…"))), so the helper is
 * put on the toast functions once, here, in the module of the one <Toaster>
 * the root layout mounts: a string title or description becomes
 * thaiCopy(string); a node or a function is passed on unchanged. The words a
 * screen reader gets are the same, and a test that mocks "sonner" still sees
 * the plain string.
 *
 * Only the named functions below and toast.promise are covered. The bare
 * call toast("…") and toast.custom go straight to sonner's store and skip the
 * helper: raise a neutral toast with toast.message("…") instead.
 *
 * The same functions set how long a toast stays (components.md §10): 4 s,
 * errors 6 s, and a call may set its own `duration`, which wins. Every tone
 * gets a time, not only errors: sonner merges a same-id update into the toast
 * on screen, so a success that replaces an error would otherwise keep the
 * error's 6 s. toast.promise gets the same: its loading text and a string
 * success / error state go through the helper, and the settled toast stays
 * 4 s, or 6 s when it is the error (sonner builds those states itself, not
 * through toast.success / toast.error, so they are wrapped here too).
 */
const TOAST_MS = 4000
const ERROR_TOAST_MS = 6000
const TOAST_TONES = ["success", "info", "warning", "error", "message", "loading"] as const
const THAI_COPY = Symbol.for("student-liff.toast.thaiCopy")
const patchable = toast as typeof toast & { [THAI_COPY]?: true }
if (!patchable[THAI_COPY]) {
  patchable[THAI_COPY] = true
  for (const tone of TOAST_TONES) {
    const raise = toast[tone]
    if (typeof raise !== "function") continue
    toast[tone] = (message, data?: ExternalToast) =>
      raise(typeof message === "string" ? thaiCopy(message) : message, {
        duration: tone === "error" ? ERROR_TOAST_MS : TOAST_MS,
        ...data,
        ...(typeof data?.description === "string" ? { description: thaiCopy(data.description) } : null),
      })
  }
  const raisePromise = toast.promise
  if (typeof raisePromise === "function") {
    toast.promise = (promise, data) =>
      raisePromise(
        promise,
        data && {
          ...data,
          loading: typeof data.loading === "string" ? thaiCopy(data.loading) : data.loading,
          success: settledState(data.success, data.duration ?? TOAST_MS),
          error: settledState(data.error, data.duration ?? ERROR_TOAST_MS),
          description: settledText(data.description),
        },
      )
  }
}

type PromiseOptions = NonNullable<Parameters<typeof toast.promise>[1]>
type PromiseState = PromiseOptions["success"] | PromiseOptions["error"]

/**
 * A toast.promise success or error state as sonner's "extended result": the
 * same message (a string through thaiCopy), plus the time the toast stays.
 * Undefined stays undefined, so sonner still skips a state the call left out.
 */
function settledState(state: PromiseState, duration: number) {
  if (state === undefined) return undefined
  return async (value: unknown) => {
    const result: unknown = typeof state === "function" ? await state(value) : state
    // Sonner's own test for an extended result: an object that is not a React element.
    if (typeof result === "object" && result !== null && !isValidElement(result) && "message" in result) {
      const extended = result as { message: ReactNode; duration?: number }
      return {
        duration,
        ...extended,
        message: typeof extended.message === "string" ? thaiCopy(extended.message) : extended.message,
      }
    }
    return { message: typeof result === "string" ? thaiCopy(result) : (result as ReactNode), duration }
  }
}

/** A toast.promise description, a string through thaiCopy. */
function settledText(text: PromiseOptions["description"]): PromiseOptions["description"] {
  if (typeof text === "string") return thaiCopy(text)
  if (typeof text !== "function") return text
  return async (value: unknown) => {
    const result = await text(value)
    return typeof result === "string" ? thaiCopy(result) : result
  }
}

/**
 * Sonner pauses every toast timer while the pointer is over the toaster
 * (mouseenter / mousemove) and resumes on mouseleave. After a touch the
 * browser sends those compatibility mouse events with no mouseleave, so a tap
 * or a hold on a toast would keep it on screen until the next tap elsewhere,
 * and the 4 s / 6 s above would not hold on a phone. When a touch or pen
 * contact on the toaster ends, this sends the toaster the mouseleave the
 * finger never makes: the timer pauses while the finger is down and runs on
 * after it lifts. It goes once shortly after the lift, and again after the
 * click a tap ends with (some browsers send the compatibility mouse events
 * late). A mouse is left alone, so desktop hover still pauses.
 *
 * A contact the browser cancels (pointercancel, e.g. a long press that starts
 * text selection or a system gesture) never gets a pointerup, and sonner 2
 * clears its "interacting" and swiping state only on pointerup, so the toast
 * would stay until it is tapped again. For a cancel inside the toaster the
 * hook first sends sonner that pointerup, with the toast's swipe offset set
 * back to 0 so sonner reads it as a release, never as a swipe to dismiss (a
 * cancel is not a swipe), then releases the toaster as above. The replayed
 * pointerup is ignored by the hook's own listener.
 */
const TOUCH_RELEASE_MS = 80
const TAP_CLICK_WINDOW_MS = 1000

/**
 * The pointerup a cancelled contact never got, for sonner, as a release in
 * place: the toast's swipe offset goes back to 0 first, because sonner
 * measures the swipe from these two properties on pointerup (45px or more, or
 * a fast enough move, dismisses).
 */
function releaseForCancelledContact(event: PointerEvent, target: Element): PointerEvent {
  const toastElement = target.closest<HTMLElement>("[data-sonner-toast]")
  toastElement?.style.setProperty("--swipe-amount-x", "0px")
  toastElement?.style.setProperty("--swipe-amount-y", "0px")
  return new PointerEvent("pointerup", {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
  })
}

function useReleaseToasterAfterTouch() {
  useEffect(() => {
    let touchEndedAt = 0
    let replayedPointerUp: Event | null = null
    const timers = new Set<number>()
    const toasterOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-sonner-toaster]") : null
    const release = (toaster: HTMLElement) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        toaster.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }))
      }, TOUCH_RELEASE_MS)
      timers.add(timer)
    }
    const onContactEnd = (event: PointerEvent) => {
      if (event === replayedPointerUp || event.pointerType === "mouse") return
      const toaster = toasterOf(event.target)
      if (!toaster) return
      // (Any browser that sends pointercancel has PointerEvent; jsdom has neither.)
      if (event.type === "pointercancel" && event.target instanceof Element && typeof PointerEvent === "function") {
        // Dispatch is synchronous: the hook's own pointerup listener sees this event and skips it.
        replayedPointerUp = releaseForCancelledContact(event, event.target)
        try {
          event.target.dispatchEvent(replayedPointerUp)
        } finally {
          replayedPointerUp = null
        }
      }
      touchEndedAt = Date.now()
      release(toaster)
    }
    const onClick = (event: MouseEvent) => {
      if (Date.now() - touchEndedAt > TAP_CLICK_WINDOW_MS) return
      const toaster = toasterOf(event.target)
      if (toaster) release(toaster)
    }
    document.addEventListener("pointerup", onContactEnd, true)
    document.addEventListener("pointercancel", onContactEnd, true)
    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("pointerup", onContactEnd, true)
      document.removeEventListener("pointercancel", onContactEnd, true)
      document.removeEventListener("click", onClick, true)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])
}

/** 32px tone tile that leads every toast (status = icon + colour + the toast's words). */
function ToneTile({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span aria-hidden="true" className={`flex size-8 items-center justify-center rounded-[10px] ${className}`}>
      {children}
    </span>
  )
}

/**
 * App toaster (components.md §10): elevated surface, 1.5px clay rim, radius 18,
 * popover shadow, a leading 32px tone tile; polite and never steals focus.
 * Toasts stay neutral surfaces (no rich colour fills), so the tile carries the tone.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  useReleaseToasterAfterTouch()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <ToneTile className="bg-success-bg text-success-fg">
            <CircleCheckIcon className="size-5" strokeWidth={2.2} />
          </ToneTile>
        ),
        info: (
          <ToneTile className="bg-info-bg text-info-fg">
            <InfoIcon className="size-5" strokeWidth={2.2} />
          </ToneTile>
        ),
        warning: (
          <ToneTile className="bg-warning-bg text-warning-fg">
            <TriangleAlertIcon className="size-5" strokeWidth={2.2} />
          </ToneTile>
        ),
        error: (
          <ToneTile className="bg-danger-bg text-danger-fg">
            <CircleAlertIcon className="size-5" strokeWidth={2.2} />
          </ToneTile>
        ),
        loading: (
          <ToneTile className="bg-tile-neutral text-icon-neutral">
            <Loader2Icon className="size-5 animate-spin" />
          </ToneTile>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--surface-elevated)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--clay-rim)",
          "--border-radius": "18px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast gap-3! border-[1.5px]! px-3.5! py-3! font-sans text-[15px]! leading-[1.6] shadow-[var(--shadow-popover)]!",
          icon: "m-0! size-8!",
          title: "font-semibold! leading-[1.6]!",
          description: "text-fg-muted! leading-[1.6]!",
        },
      }}
      // Top-centre under the app bar (components.md §10): clear of the notch /
      // status bar (safe-top) and of the 56px bar, so back and title stay usable.
      offset={{ top: "calc(var(--safe-top) + var(--appbar-h) + 12px)" }}
      mobileOffset={{ top: "calc(var(--safe-top) + var(--appbar-h) + 8px)" }}
      {...props}
    />
  )
}

export { Toaster }
