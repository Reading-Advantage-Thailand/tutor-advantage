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
}

/**
 * Message composer pinned under the list: 16px auto-growing input with a
 * "send" key, 44px send button. Sending keeps the keyboard open (the button
 * never steals focus from the input).
 */
export function Composer({ value, onChange, onSend, sending }: ComposerProps) {
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
      className="shrink-0 border-t border-hairline bg-surface px-3 pt-2 pb-[max(8px,var(--safe-bottom))] group-data-[keyboard]/room:pb-2"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          enterKeyHint="send"
          autoComplete="off"
          placeholder={t("chat.messagePlaceholder")}
          aria-label={t("chat.messagePlaceholder")}
          className="block min-h-11 flex-1 resize-none overflow-y-auto rounded-[22px] border border-hairline bg-fill-muted px-4 py-2.5 text-base leading-[1.4] text-fg outline-none placeholder:text-fg-subtle focus:border-brand-vivid"
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
          className="pressable flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-solid text-white transition-colors duration-150 disabled:bg-fill-muted disabled:text-fg-subtle"
        >
          <SendHorizontal aria-hidden="true" className="size-5" strokeWidth={2.2} />
        </button>
      </div>
    </form>
  );
}
