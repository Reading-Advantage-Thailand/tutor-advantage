"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { t } from "@/lib/i18n";

/** The textarea grows with the text up to about 5 lines, then scrolls. */
const MAX_INPUT_HEIGHT_PX = 128;

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Send the current text (the caller checks it is not blank). */
  onSend: () => void;
  /** A send is in flight (one at a time). */
  sending: boolean;
  /** Input placeholder and accessible name (default: the chat one). */
  placeholder?: string;
}

/**
 * Message composer pinned under the list (patterns.md S13/S14): a 52px
 * auto-growing field (16px text, 2px field border drawn inset so the
 * auto-height measures it exactly, focus = jade border + the blue ring) and a 44px round send button. Sending keeps the keyboard open
 * (the button never steals focus from the input).
 */
export function Composer({ value, onChange, onSend, sending, placeholder }: ComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keepFocusRef = useRef(false);
  const canSend = value.trim().length > 0 && !sending;

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
  }, [value]);

  const send = () => {
    if (!canSend) return;
    const keepFocus = keepFocusRef.current || document.activeElement === inputRef.current;
    keepFocusRef.current = false;
    onSend();
    // Still inside the tap/keypress gesture, so iOS keeps the keyboard up.
    if (keepFocus) inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter (the "send" key) sends; Shift+Enter adds a new line on a hardware keyboard.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="shrink-0 border-t-[1.5px] border-clay-rim bg-[var(--surface-nav)] px-3 pt-2.5 pb-[max(10px,var(--safe-bottom))] group-data-[keyboard]/room:pb-2.5"
    >
      <div className="flex items-end gap-2.5">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          enterKeyHint="send"
          autoComplete="off"
          placeholder={placeholder ?? t("chat.messagePlaceholder")}
          aria-label={placeholder ?? t("chat.messagePlaceholder")}
          className="block min-h-[52px] min-w-0 flex-1 resize-none overflow-y-auto rounded-[var(--radius-field)] border-0 bg-surface px-4 py-[13px] text-base leading-[1.6] text-fg shadow-[inset_0_0_0_2px_var(--field-border)] transition-[box-shadow] duration-[var(--duration-fast)] placeholder:text-fg-subtle focus:shadow-[inset_0_0_0_2px_var(--brand-fg)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        />
        <button
          type="submit"
          aria-label={t("chat.send")}
          disabled={!canSend}
          onPointerDown={(event) => {
            // Keep focus (and the keyboard) on the input.
            keepFocusRef.current = document.activeElement === inputRef.current;
            event.preventDefault();
          }}
          className="mb-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-solid text-on-brand shadow-[0_var(--ledge-sm)_0_var(--brand-solid-edge)] transition-[translate,box-shadow,background-color,color] duration-[var(--duration-press)] ease-[var(--ease-out)] [-webkit-tap-highlight-color:transparent] active:not-disabled:translate-y-[2px] active:not-disabled:shadow-[0_1px_0_var(--brand-solid-edge)] disabled:bg-fill-muted disabled:text-fg-subtle disabled:shadow-none"
        >
          <SendHorizontal aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
        </button>
      </div>
    </form>
  );
}
