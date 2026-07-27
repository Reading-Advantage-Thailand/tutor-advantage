"use client";

import React, { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ActionPower = "basic" | "power";

export interface ActionMenuAction {
  id: string;
  label: string;
  power: ActionPower;
}

interface ActionMenuProps {
  actions: ActionMenuAction[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export function ActionMenu({
  actions,
  value,
  onChange,
  onSubmit,
  disabled = false,
}: ActionMenuProps) {
  const trimmedValue = value.trim();
  const isReady = trimmedValue.length > 0;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || !isReady) return;
    onSubmit(trimmedValue);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-4 shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100">Actions</span>
        <span className="text-xs text-slate-400">Type the translation</span>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {actions.map((action) => (
          <div
            key={action.id}
            className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm transition-colors hover:bg-slate-800/80"
          >
            <span className="font-medium text-slate-100">{action.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                action.power === "power"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {action.power === "power" ? "Power" : "Basic"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Action input"
          placeholder="Type translation..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoFocus={!disabled}
          ref={inputRef}
          className="h-11 bg-slate-800/60 border-slate-700/50 text-slate-100 placeholder:text-slate-500"
        />
        <Button
          type="submit"
          disabled={disabled || !isReady}
          className="sm:w-28"
        >
          Cast
        </Button>
      </div>
    </form>
  );
}
