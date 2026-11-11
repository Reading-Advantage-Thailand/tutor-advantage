"use client";

import { memo, useMemo } from "react";
import { Group, Rect, Text } from "react-konva";

import { WORD_RADIUS, type Word } from "@/lib/games/castleDefense";
import { estimateTextWidth } from "@/lib/games/textFit";

const LABEL_PADDING = 18;
const FONT_FAMILY = "Arial";

let measureContext: CanvasRenderingContext2D | null | undefined;

function labelWidth(text: string, fontSize: number): number {
  if (measureContext === undefined) {
    measureContext = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  if (!measureContext) return estimateTextWidth(text, fontSize);
  measureContext.font = `bold ${fontSize}px ${FONT_FAMILY}`;
  return measureContext.measureText(text).width;
}

type WordOrbProps = {
  word: Word;
  fontSize: number;
  /** Shows red for a moment after a wrong touch. */
  flash?: boolean;
};

/** A word on the map: a circle for a short word, a pill sized to the label for a long one. */
export const WordOrb = memo(function WordOrb({ word, fontSize, flash = false }: WordOrbProps) {
  const width = useMemo(
    () => Math.max(WORD_RADIUS * 2, labelWidth(word.translation, fontSize) + LABEL_PADDING),
    [word.translation, fontSize],
  );

  return (
    <Group x={word.x} y={word.y} listening={false}>
      <Rect
        x={-width / 2}
        y={-WORD_RADIUS}
        width={width}
        height={WORD_RADIUS * 2}
        cornerRadius={WORD_RADIUS}
        fill={flash ? "#fecaca" : "white"}
        stroke={flash ? "#dc2626" : "#111"}
        strokeWidth={flash ? 4 : 2}
      />
      <Text
        text={word.translation}
        fontSize={fontSize}
        fontFamily={FONT_FAMILY}
        fontStyle="bold"
        fill="black"
        x={-width / 2}
        y={-WORD_RADIUS}
        width={width}
        height={WORD_RADIUS * 2}
        align="center"
        verticalAlign="middle"
        wrap="none"
      />
    </Group>
  );
});
