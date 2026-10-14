/**
 * Copy text to the clipboard. Uses the async Clipboard API and falls back to a
 * hidden <textarea> + execCommand("copy") (older LINE WebViews / non-secure
 * contexts) — the same behaviour Home always had. Rejects only when the
 * fallback itself throws.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    try {
      textarea.select();
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
