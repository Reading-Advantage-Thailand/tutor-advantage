"use client";

import { Languages } from "lucide-react";
import { useThaiTranslations } from "@/hooks/useThaiTranslations";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TranslationItem } from "./questionModels";

/** Thai translation of the answer / prompt, fetched on demand. */
export function AnswerTranslations({ items, className }: { items: TranslationItem[]; className?: string }) {
  const texts = items.map((item) => item.text);
  const { translations, loading } = useThaiTranslations(texts, { enabled: texts.some(Boolean) });

  if (!loading && translations.every((item) => !item)) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted">
        <Languages aria-hidden="true" className="size-4" />
        {t("lesson.live.thaiTranslation")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item, index) => (
          <div key={`${item.label}-${item.text}`} className="rounded-lg border border-hairline bg-surface-muted px-3 py-2">
            {item.label ? <p className="text-[0.8125rem] text-fg-muted">{item.label}</p> : null}
            <p className="text-base font-medium leading-relaxed text-fg">
              {translations[index] || (loading ? t("lesson.live.translating") : "-")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
