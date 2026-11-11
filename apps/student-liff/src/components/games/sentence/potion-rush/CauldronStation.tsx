import React, { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Group, Rect, Text, Image as KonvaImage } from "react-konva";
import { usePotionRushStore } from "@/store/usePotionRushStore";
import { useGameImages } from "@/lib/games/useGameImages";
import { tx } from "@/lib/games/gameText";

const CAULDRON_IMAGES = {
  blue: "/games/sentence/potion-rush/cauldron-blue.webp",
  green: "/games/sentence/potion-rush/cauldron-green.webp",
  yellow: "/games/sentence/potion-rush/cauldron-yellow.webp",
};

const REJECTED_WORD_MS = 1_000;

interface CauldronStationProps {
  y: number;
  width: number;
}

export default function CauldronStation({ y, width }: CauldronStationProps) {
  const { images } = useGameImages(CAULDRON_IMAGES);
  const stationWidth = width / 3;

  return (
    <Group y={y}>
      {[0, 1, 2].map((slot) => (
        <SingleCauldron
          key={slot}
          slot={slot}
          x={stationWidth * slot + stationWidth / 2}
          y={-20}
          images={images}
        />
      ))}
    </Group>
  );
}

function SingleCauldron({
  slot,
  x,
  y,
  images,
}: {
  slot: number;
  x: number;
  y: number;
  images: Record<string, HTMLImageElement>;
}) {
  const potState = usePotionRushStore((state) => state.cauldrons[slot]?.state ?? "IDLE");
  const hasCustomer = usePotionRushStore((state) => {
    const customer = state.customers[slot];
    return customer?.state === "WAITING" || customer?.state === "LEAVING_HAPPY";
  });
  const isFocused = usePotionRushStore((state) => state.focusedSlot === slot);
  const isDropTarget = usePotionRushStore((state) => state.dragTargetSlot === slot);
  const rejection = usePotionRushStore((state) =>
    state.lastRejection?.slot === slot ? state.lastRejection : null,
  );
  const setFocusedSlot = usePotionRushStore((state) => state.setFocusedSlot);

  const groupRef = useRef<Konva.Group | null>(null);
  const [rejectedWord, setRejectedWord] = useState<string | null>(null);

  useEffect(() => {
    if (!rejection) {
      setRejectedWord(null);
      return;
    }
    setRejectedWord(rejection.word);
    const node = groupRef.current;
    if (node) {
      node.x(x);
      node.to({
        x: x + 8,
        duration: 0.05,
        onFinish: () =>
          node.to({
            x: x - 8,
            duration: 0.05,
            onFinish: () =>
              node.to({
                x: x + 4,
                duration: 0.05,
                onFinish: () => node.to({ x, duration: 0.05 }),
              }),
          }),
      });
    }
    const timer = setTimeout(() => setRejectedWord(null), REJECTED_WORD_MS);
    return () => clearTimeout(timer);
  }, [rejection, x]);

  const img =
    potState === "COMPLETED" ? images.yellow : potState === "BREWING" ? images.green : images.blue;
  const focus = () => setFocusedSlot(slot);

  return (
    <Group ref={groupRef} x={x} y={y} opacity={hasCustomer ? 1 : 0.5} onClick={focus} onTap={focus}>
      {(isDropTarget || (isFocused && hasCustomer)) && (
        <Rect
          x={-63}
          y={-76}
          width={126}
          height={152}
          cornerRadius={26}
          fill={isDropTarget ? "rgba(255, 255, 255, 0.28)" : "rgba(251, 191, 36, 0.2)"}
          stroke={isDropTarget ? "white" : "#fbbf24"}
          strokeWidth={isDropTarget ? 5 : 3}
          listening={false}
        />
      )}

      {img ? (
        <KonvaImage image={img} x={-75} y={-75} width={150} height={150} />
      ) : (
        <Rect x={-50} y={-50} width={100} height={100} fill="#333" />
      )}

      {potState === "COMPLETED" && (
        <Text
          text={tx("DONE!")}
          fontSize={26}
          fontStyle="bold"
          fill="white"
          x={-65}
          y={-14}
          width={130}
          align="center"
          stroke="#111827"
          strokeWidth={5}
          fillAfterStrokeEnabled
          listening={false}
        />
      )}

      {rejectedWord && (
        <Text
          text={rejectedWord}
          fontSize={18}
          fontStyle="bold"
          fill="#ef4444"
          x={-65}
          y={-10}
          width={130}
          align="center"
          wrap="none"
          ellipsis
          stroke="white"
          strokeWidth={4}
          fillAfterStrokeEnabled
          listening={false}
        />
      )}
    </Group>
  );
}
