"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyableIdProps {
  /** Label shown above the ID chip */
  name?: string;
  id: string;
  /**
   * "label"  → tiny all-caps label style (settlements: "Snapshot ID")
   * "name"   → regular text style (adjustments: tutor display name)
   * @default "label"
   */
  variant?: "label" | "name";
}

export function CopyableId({ name, id, variant = "label" }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncated = id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

  return (
    <div>
      {name && (
        <p
          className={
            variant === "name"
              ? "font-bold text-foreground text-xs mb-0.5"
              : "font-bold text-foreground text-[10px] uppercase tracking-wider mb-1 opacity-60"
          }
        >
          {name}
        </p>
      )}
      <div
        className={`flex items-center bg-muted/50 rounded-md border border-border/50 ${
          variant === "name" ? "gap-1 w-fit px-2 py-0.5" : "gap-2 px-2 py-1"
        }`}
      >
        <p className="font-mono text-[10px] text-muted-foreground">{truncated}</p>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-brand-600 transition-colors"
          title="Copy full ID"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
}
