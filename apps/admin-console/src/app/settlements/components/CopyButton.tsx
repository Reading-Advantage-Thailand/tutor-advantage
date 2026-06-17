import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Icon-only copy button used inside the payout lines table */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      title="คัดลอก ID"
      aria-label="คัดลอก ID"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
