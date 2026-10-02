"use client";

import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tileToneClass, type TileTone } from "@/components/app/Atoms";
import { cn } from "@/lib/utils";

const PLACEHOLDER_TONES: TileTone[] = ["brand", "teal", "blue", "amber", "purple", "orange", "pink"];

/**
 * Article cover thumbnail. Falls back to a tinted book tile when the article
 * has no image or the image fails to load, including failures that happen
 * before hydration (React never sees that `error` event, so we also check
 * `complete && naturalWidth === 0` on mount).
 */
export function LessonCover({
  src,
  alt,
  seed,
  className,
  iconClassName,
  eager = false,
}: {
  src: string | null;
  alt: string;
  /** Picks a stable placeholder tone (e.g. the article number). */
  seed: number;
  className?: string;
  iconClassName?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFailed(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  const tone = PLACEHOLDER_TONES[Math.abs(seed) % PLACEHOLDER_TONES.length];
  const showImage = Boolean(src) && !failed;

  return (
    <div className={cn("relative overflow-hidden", !showImage && tileToneClass[tone], className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote covers on arbitrary hosts; next/image remotePatterns are not configured
        <img
          ref={imgRef}
          src={src ?? undefined}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div role="img" aria-label={alt} className="absolute inset-0 flex items-center justify-center">
          <BookOpen aria-hidden="true" className={cn("size-6 opacity-80", iconClassName)} />
        </div>
      )}
    </div>
  );
}
