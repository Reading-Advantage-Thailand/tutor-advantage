"use client";

import { useState } from "react";
import { ExternalLink, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Sheet } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import "@/locales/th/userDetail";

/**
 * Identity document viewer in a Sheet (bottom sheet on phones): zoom,
 * rotate, open original. The image never stretches the page; it scrolls
 * inside the sheet body.
 */
export function DocumentViewer({
  open,
  onOpenChange,
  title,
  url,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string | null;
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      onClosed={() => {
        setZoom(1);
        setRotation(0);
      }}
      title={title}
      width={880}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label={t("userDetail.viewerZoomOut")} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              <ZoomOut />
            </Button>
            <span className="w-12 text-center text-[0.8125rem] text-fg-muted tabular">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" aria-label={t("userDetail.viewerZoomIn")} onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
              <ZoomIn />
            </Button>
            <Button variant="outline" size="icon" aria-label={t("userDetail.viewerRotate")} onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateCw />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("userDetail.viewerReset")}
              onClick={() => {
                setZoom(1);
                setRotation(0);
              }}
            >
              <RotateCcw />
            </Button>
          </div>
          {url ? (
            <Button variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> {t("userDetail.viewerOpenOriginal")}
              </a>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex min-h-[50vh] items-center justify-center overflow-auto rounded-lg bg-surface-muted p-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed/arbitrary document URLs, not optimisable
          <img
            src={url}
            alt={title}
            className="max-h-[70vh] max-w-full rounded-md bg-surface object-contain shadow-card transition-transform duration-150"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: "center center" }}
          />
        ) : (
          <p className="text-sm text-fg-muted">{t("userDetail.documentMissing")}</p>
        )}
      </div>
    </Sheet>
  );
}
