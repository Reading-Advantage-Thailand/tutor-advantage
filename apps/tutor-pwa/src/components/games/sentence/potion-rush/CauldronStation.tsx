import React, { useEffect, useState } from "react";
import { Group, Rect, Text, Image as KonvaImage } from "react-konva";
import { usePotionRushStore, Cauldron } from "@/store/usePotionRushStore";
import { withBasePath } from "@/lib/games/basePath";
import { useSound } from "@/hooks/useSound";

interface LayoutConfig {
  trashX: number;
  trashY: number;
  customerY: number;
}

interface CauldronStationProps {
  y: number;
  width: number;
  layout: LayoutConfig;
}

export default function CauldronStation({
  y,
  width,
  layout,
}: CauldronStationProps) {
  const cauldrons = usePotionRushStore((state) => state.cauldrons);
  const handleDump = usePotionRushStore((state) => state.handleDumpCauldron);
  const handleServe = usePotionRushStore((state) => state.handleServeCustomer);

  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const assets = {
      blue: withBasePath("/games/sentence/potion-rush/cauldron-blue.png"),
      green: withBasePath("/games/sentence/potion-rush/cauldron-green.png"),
      yellow: withBasePath("/games/sentence/potion-rush/cauldron-yellow.png"),
    };
    const loadedImgs: Record<string, HTMLImageElement> = {};
    let count = 0;
    const sources = Object.entries(assets);
    sources.forEach(([key, src]) => {
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        loadedImgs[key] = img;
        count++;
        if (count === sources.length) setImages(loadedImgs);
      };
    });
  }, []);

  const stationWidth = width / 3;

  const checkDrop = (cauldronIndex: number, x: number, y: number) => {
    const trashDist = Math.sqrt(
      Math.pow(x - layout.trashX, 2) + Math.pow(y - layout.trashY, 2),
    );
    if (trashDist < 70) {
      handleDump(cauldronIndex);
      return;
    }

    if (y < layout.customerY + 100) {
      const customers = usePotionRushStore.getState().customers;
      const slotWidth = width / 3;
      const customerIndex = Math.floor(x / slotWidth);
      const customer = customers[customerIndex];

      if (customer) {
        handleServe(customer.id, cauldronIndex, { x, y });
      }
    }
  };

  return (
    <Group y={y}>
      {cauldrons.map((cauldron, i) => (
        <SingleCauldron
          key={cauldron.id}
          cauldron={cauldron}
          x={stationWidth * i + stationWidth / 2}
          y={-20}
          onDrop={(cx, cy) => checkDrop(i, cx, cy)}
          images={images}
        />
      ))}
    </Group>
  );
}

function SingleCauldron({
  cauldron,
  x,
  y,
  onDrop,
  images,
}: {
  cauldron: Cauldron;
  x: number;
  y: number;
  onDrop: (x: number, y: number) => void;
  images: Record<string, HTMLImageElement>;
}) {
  const { playSound } = useSound();
  const getImage = () => {
    if (cauldron.state === "WARNING") return images.green;
    if (cauldron.state === "COMPLETED") return images.yellow;
    return images.blue;
  };

  const img = getImage();

  return (
    <Group
      x={x}
      y={y}
      draggable={cauldron.state !== "IDLE"}
      onDragStart={() => {
        playSound("clinking");
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        const pt = stage?.getPointerPosition();
        if (pt && stage) {
          const scale = stage.scaleX();
          const stagePos = stage.position();
          const virtualX = (pt.x - stagePos.x) / scale;
          const virtualY = (pt.y - stagePos.y) / scale;
          onDrop(virtualX, virtualY);
        }
        e.target.to({ x: x, y: y, duration: 0.2 });
      }}
    >
      {img ? (
        <KonvaImage
          image={img}
          x={-75}
          y={-75}
          width={150}
          height={150}
          opacity={1}
        />
      ) : (
        <Rect x={-50} y={-50} width={100} height={100} fill="#333" />
      )}

      <Group y={-80}>
        {cauldron.currentWords.map((word, i) => (
          <Text
            key={i}
            text={word}
            x={-40}
            y={-25 * (cauldron.currentWords.length - 1 - i)}
            fill="white"
            fontSize={16}
            fontStyle="bold"
            stroke="black"
            strokeWidth={4}
            fillAfterStrokeEnabled={true}
          />
        ))}
      </Group>

      {cauldron.state === "COMPLETED" && (
        <Text
          text="DONE!"
          fontSize={24}
          fontStyle="bold"
          fill="#facc15"
          x={-35}
          y={-40}
          stroke="black"
          strokeWidth={1}
        />
      )}
      {cauldron.state === "WARNING" && (
        <Text
          text="RUINED!"
          fontSize={18}
          fontStyle="bold"
          fill="#ef4444"
          x={-40}
          y={40}
          stroke="black"
          strokeWidth={1}
        />
      )}
    </Group>
  );
}
