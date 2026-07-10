import * as React from "react";

const translationCache = new Map<string, string>();

function normalizeText(text: unknown): string {
  return String(text || "")
    .trim()
    .replace(/(^|\n)\s*[0-9๐-๙]+[.)]\s*/g, "$1")
    .trim();
}

function expandNumberedTranslations(
  translations: string[] = [],
  expectedLength: number,
): string[] {
  const hasNumberedBlock = translations.some(
    (translation) =>
      Array.from(
        String(translation || "").matchAll(/(^|\n)\s*[0-9๐-๙]+[.)]\s*/g),
      ).length > 1,
  );

  if (translations.length === expectedLength && !hasNumberedBlock) {
    return translations.map(normalizeText);
  }

  const joined = translations.map(normalizeText).filter(Boolean).join("\n");
  if (!joined) return translations;

  const markers = Array.from(
    joined.matchAll(/(^|\n)\s*[0-9๐-๙]+[.)]\s*/g),
  );
  if (markers.length < 2) return translations.map(normalizeText);

  const expanded = markers.map((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const nextMarker = markers[index + 1];
    const end = nextMarker?.index ?? joined.length;
    return normalizeText(joined.slice(start, end));
  });

  return expanded.length >= expectedLength ? expanded : translations;
}

function getCachedTranslations(
  texts: string[],
  initialTranslations: string[] = [],
): string[] {
  const expandedInitialTranslations = expandNumberedTranslations(
    initialTranslations,
    texts.length,
  );

  return texts.map((text, index) => {
    const normalized = normalizeText(text);
    if (!normalized) return "";

    const initial = normalizeText(expandedInitialTranslations[index]);
    if (initial) {
      translationCache.set(normalized, initial);
      return initial;
    }

    const cached = normalizeText(translationCache.get(normalized));
    return cached.includes("\n") ? "" : cached;
  });
}

export function useThaiTranslations(
  texts: string[],
  options: {
    enabled?: boolean;
    initialTranslations?: string[];
  } = {},
) {
  const { enabled = true, initialTranslations = [] } = options;
  const textsKey = React.useMemo(() => JSON.stringify(texts), [texts]);
  const initialKey = React.useMemo(
    () => JSON.stringify(initialTranslations),
    [initialTranslations],
  );
  const [translations, setTranslations] = React.useState<string[]>(() =>
    getCachedTranslations(texts, initialTranslations),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const currentTexts = JSON.parse(textsKey) as string[];
    const currentInitial = JSON.parse(initialKey) as string[];
    const cached = getCachedTranslations(currentTexts, currentInitial);
    setTranslations(cached);

    if (!enabled) return;

    const missing = currentTexts
      .map((text, index) => ({ text: normalizeText(text), index }))
      .filter(({ text, index }) => text && !cached[index]);

    if (missing.length === 0) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: missing.map((item) => item.text) }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Translation failed");
        return response.json();
      })
      .then((data: { translations?: string[] }) => {
        if (cancelled || !Array.isArray(data.translations)) return;

        const next = [...cached];
        missing.forEach((item, batchIndex) => {
          const translated = normalizeText(data.translations?.[batchIndex]);
          if (!translated) return;
          translationCache.set(item.text, translated);
          next[item.index] = translated;
        });
        setTranslations(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Translation failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, textsKey, initialKey]);

  return { translations, loading, error };
}
