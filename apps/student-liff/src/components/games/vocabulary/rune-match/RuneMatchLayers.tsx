"use client";

import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Image as KonvaImage, Layer, Rect, Text } from "react-konva";
import type { Group as KonvaGroup } from "konva/lib/Group";
import type { Circle as KonvaCircleNode } from "konva/lib/shapes/Circle";
import type { FloatingText, GridPosition, MatchBurst, Rune, RuneMatchState } from "@/lib/games/runeMatch";
import { fitText } from "@/lib/games/textFit";
import {
  cellPosition,
  clampLabelCenter,
  type Box,
  type RuneLabelPresentation,
  type RuneMatchLayout,
} from "@/lib/games/runeMatchPresentation";

/**
 * The stage is split so a tap or a clock tick redraws as little as possible on a
 * slow phone:
 * - Backdrop: drawn once.
 * - Board: tiles and skill buttons. Redraws only when a tile changes, and is the
 *   only layer that takes taps.
 * - Status: goblin, bars, message and effects. Redraws often but is cheap, and
 *   takes no taps so nothing here can swallow a tap meant for a tile.
 *
 * Konva copies a shape through a full-stage buffer when it has fill, stroke and
 * opacity or shadow together. FAST_SHAPE turns that off on every such shape.
 */
const FAST_SHAPE = { perfectDrawEnabled: false, shadowForStrokeEnabled: false } as const;

const TILE_MOVE_SECONDS = 0.16;

const easeOut = (t: number, b: number, c: number, d: number) => {
  const p = t / d - 1;
  return c * (p * p * p + 1) + b;
};
const easeIn = (t: number, b: number, c: number, d: number) => {
  const p = t / d;
  return c * p * p + b;
};

export const BackdropLayer = memo(function BackdropLayer({
  width,
  height,
  background,
  layout,
}: {
  width: number;
  height: number;
  background: HTMLImageElement;
  layout: RuneMatchLayout;
}) {
  const framePad = layout.compact ? 4 : 6;
  return (
    <Layer listening={false}>
      <Rect width={width} height={height} fill="#17324d" />
      <KonvaImage image={background} width={width} height={height} opacity={0.42} />
      <Rect width={width} height={height} fill="rgba(255, 255, 255, 0.05)" />
      {layout.isMobile ? (
        <Rect
          {...layout.panel}
          fill="rgba(8, 20, 36, 0.94)"
          stroke="rgba(125, 211, 252, 0.55)"
          strokeWidth={1.5}
          cornerRadius={14}
          shadowColor="#020617"
          shadowBlur={10}
          shadowOpacity={0.45}
          {...FAST_SHAPE}
        />
      ) : (
        <Rect
          {...layout.panel}
          fill="rgba(8, 20, 36, 0.9)"
          stroke="rgba(125, 211, 252, 0.35)"
          strokeWidth={1}
          {...FAST_SHAPE}
        />
      )}
      <Rect
        {...layout.strip}
        fill="rgba(8, 20, 36, 0.88)"
        stroke="rgba(125, 211, 252, 0.35)"
        strokeWidth={1}
        cornerRadius={10}
        {...FAST_SHAPE}
      />
      <Rect
        x={layout.gridX - framePad}
        y={layout.gridY - framePad}
        width={layout.gridWidth + framePad * 2}
        height={layout.gridHeight + framePad * 2}
        fill="rgba(226, 232, 240, 0.18)"
        cornerRadius={12}
        stroke="rgba(186, 230, 253, 0.7)"
        strokeWidth={2}
        {...FAST_SHAPE}
      />
    </Layer>
  );
});

type RuneTileProps = {
  rune: Rune;
  row: number;
  col: number;
  x: number;
  y: number;
  cellSize: number;
  selected: boolean;
  hinted: boolean;
  label: RuneLabelPresentation | undefined;
  sheet: HTMLImageElement;
  onTap: (row: number, col: number) => void;
};

/** Slides to its new place when a column closes up, and pops in when it is new. */
const RuneTile = memo(function RuneTile({
  rune,
  row,
  col,
  x,
  y,
  cellSize,
  selected,
  hinted,
  label,
  sheet,
  onTap,
}: RuneTileProps) {
  const runeSize = cellSize - 4;
  const centerX = x + cellSize / 2;
  const centerY = y + cellSize / 2;
  const groupRef = useRef<KonvaGroup>(null);
  const placedAt = useRef<{ x: number; y: number; cellSize: number } | null>(null);

  useLayoutEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    const previous = placedAt.current;
    placedAt.current = { x: centerX, y: centerY, cellSize };
    if (!previous) {
      node.opacity(0);
      node.scale({ x: 0.7, y: 0.7 });
      node.to({ opacity: 1, scaleX: 1, scaleY: 1, duration: TILE_MOVE_SECONDS, easing: easeOut });
      return;
    }
    // A new cell size means the phone was turned; just be there.
    if (previous.cellSize !== cellSize || (previous.x === centerX && previous.y === centerY)) return;
    node.position({ x: previous.x, y: previous.y });
    node.to({ x: centerX, y: centerY, duration: TILE_MOVE_SECONDS, easing: easeIn });
  }, [centerX, centerY, cellSize]);

  const handleTap = () => onTap(row, col);
  const crop = useMemo(
    () => ({ x: 0, y: 0, width: sheet.width / 3, height: sheet.height / 2 }),
    [sheet],
  );

  return (
    <Group
      ref={groupRef}
      x={centerX}
      y={centerY}
      offsetX={runeSize / 2}
      offsetY={runeSize / 2}
      onClick={handleTap}
      onTap={handleTap}
    >
      {/* The whole cell answers, so a tap between two tiles still lands on one. */}
      <Rect x={-2} y={-2} width={cellSize} height={cellSize} fill="transparent" />
      <KonvaImage image={sheet} width={runeSize} height={runeSize} crop={crop} listening={false} />
      <Rect
        x={2}
        y={runeSize * 0.1}
        width={runeSize - 4}
        height={runeSize * 0.8}
        fill="rgba(8, 20, 36, 0.92)"
        stroke="rgba(224, 242, 254, 0.9)"
        strokeWidth={1}
        cornerRadius={Math.max(5, runeSize * 0.1)}
        listening={false}
        {...FAST_SHAPE}
      />
      <Text
        text={label?.text || rune.text}
        width={runeSize - 8}
        height={runeSize * 0.8 - 4}
        x={4}
        y={runeSize * 0.1 + 2}
        fontSize={label?.fontSize || 12}
        lineHeight={label?.lineHeight || 1.12}
        fill="#ffffff"
        align="center"
        verticalAlign="middle"
        fontFamily="Sarabun, Arial"
        fontStyle="bold"
        wrap="none"
        listening={false}
      />
      {hinted && (
        <Rect
          width={runeSize + 8}
          height={runeSize + 8}
          x={-4}
          y={-4}
          fill="rgba(250, 204, 21, 0.3)"
          cornerRadius={8}
          stroke="#facc15"
          strokeWidth={3}
          listening={false}
          {...FAST_SHAPE}
        />
      )}
      {selected && (
        <Rect
          width={runeSize + 8}
          height={runeSize + 8}
          x={-4}
          y={-4}
          fill="rgba(96, 165, 250, 0.3)"
          cornerRadius={8}
          stroke="#60a5fa"
          strokeWidth={3}
          listening={false}
          {...FAST_SHAPE}
        />
      )}
    </Group>
  );
});

type SkillButtonProps = {
  box: Box;
  label: string;
  icon: string;
  count: number;
  color: string;
  textScale: number;
  onPress: () => void;
};

const SkillButton = memo(function SkillButton({ box, label, icon, count, color, textScale, onPress }: SkillButtonProps) {
  const isDisabled = count <= 0;
  const handler = isDisabled ? undefined : onPress;
  const stacked = box.width < 110;
  const fontSize = Math.round((stacked ? 12 : 15) * textScale);
  return (
    <Group x={box.x} y={box.y} onClick={handler} onTap={handler} opacity={isDisabled ? 0.62 : 1}>
      <Rect
        width={box.width}
        height={box.height}
        fill={isDisabled ? "#1e293b" : "#0f2942"}
        stroke={isDisabled ? "#334155" : color}
        strokeWidth={isDisabled ? 1 : 2}
        cornerRadius={10}
        {...FAST_SHAPE}
      />
      {stacked ? (
        <>
          <Text text={icon} y={3} width={box.width} align="center" fontSize={Math.min(18, box.height * 0.4)} listening={false} />
          <Text
            text={label}
            y={box.height - fontSize - 5}
            width={box.width}
            align="center"
            fontSize={fontSize}
            fill={isDisabled ? "#94a3b8" : "#f8fafc"}
            fontStyle="bold"
            listening={false}
          />
        </>
      ) : (
        <Text
          text={`${icon} ${label}`}
          width={box.width - 24}
          height={box.height}
          align="center"
          verticalAlign="middle"
          fontSize={fontSize}
          fill={isDisabled ? "#94a3b8" : "#f8fafc"}
          fontStyle="bold"
          listening={false}
        />
      )}
      <Group x={box.width - 14} y={stacked ? 12 : box.height / 2} listening={false}>
        <Circle radius={9} fill={color} />
        <Text
          text={String(count)}
          x={-9}
          y={-9}
          width={18}
          height={18}
          align="center"
          verticalAlign="middle"
          fontSize={Math.round(12 * textScale)}
          fill="#0f172a"
          fontStyle="bold"
        />
      </Group>
    </Group>
  );
});

export const BoardLayer = memo(function BoardLayer({
  grid,
  selectedCell,
  hintCells,
  layout,
  labels,
  sheet,
  shuffleCount,
  hintCount,
  textScale,
  onTileTap,
  onShuffle,
  onHint,
}: {
  grid: Rune[][];
  selectedCell: GridPosition | null;
  hintCells: GridPosition[];
  layout: RuneMatchLayout;
  labels: Map<string, RuneLabelPresentation>;
  sheet: HTMLImageElement;
  shuffleCount: number;
  hintCount: number;
  textScale: number;
  onTileTap: (row: number, col: number) => void;
  onShuffle: () => void;
  onHint: () => void;
}) {
  const gap = 8;
  const buttonWidth = (layout.skills.width - gap) / 2;
  const shuffleBox = useMemo(() => ({ ...layout.skills, width: buttonWidth }), [layout.skills, buttonWidth]);
  const hintBox = useMemo(
    () => ({ ...layout.skills, x: layout.skills.x + buttonWidth + gap, width: buttonWidth }),
    [layout.skills, buttonWidth],
  );
  return (
    <Layer>
      {/* One flat list keyed by tile id: a tile that drops a row keeps its node, so it can slide. */}
      {grid.flatMap((row, r) =>
        row.map((rune, c) => {
          const position = cellPosition(layout, r, c);
          return (
            <RuneTile
              key={rune.id}
              rune={rune}
              row={r}
              col={c}
              x={position.x}
              y={position.y}
              cellSize={layout.cellSize}
              selected={selectedCell?.row === r && selectedCell?.col === c}
              hinted={hintCells.some((cell) => cell.row === r && cell.col === c)}
              label={labels.get(rune.id)}
              sheet={sheet}
              onTap={onTileTap}
            />
          );
        }),
      )}
      <SkillButton box={shuffleBox} label="สลับกระดาน" icon="🔀" count={shuffleCount} color="#22c55e" textScale={textScale} onPress={onShuffle} />
      <SkillButton box={hintBox} label="คำใบ้" icon="💡" count={hintCount} color="#facc15" textScale={textScale} onPress={onHint} />
    </Layer>
  );
});

const MONSTER_FRAME_MS = 200;
const MONSTER_ROW: Record<RuneMatchState["monsterState"], number> = { idle: 0, attack: 1, hurt: 2, death: 3 };

/** Runs its own small timer, so its animation redraws only this layer and re-renders nothing else. */
const Goblin = memo(function Goblin({
  image,
  box,
  pose,
}: {
  image: HTMLImageElement;
  box: Box;
  pose: RuneMatchState["monsterState"];
}) {
  const [tick, setTick] = useState(0);
  const moving = pose !== "death";
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setTick((value) => (value + 1) % 3), MONSTER_FRAME_MS);
    return () => clearInterval(id);
  }, [moving]);
  const frame = moving ? tick : 2;
  const cellWidth = image.width / 3;
  const cellHeight = image.height / 4;
  const crop = useMemo(
    () => ({ x: frame * cellWidth, y: MONSTER_ROW[pose] * cellHeight, width: cellWidth, height: cellHeight }),
    [frame, pose, cellWidth, cellHeight],
  );
  return <KonvaImage image={image} {...box} crop={crop} cornerRadius={8} />;
});

const StatusBar = memo(function StatusBar({
  box,
  progress,
  text,
  color,
  textScale,
}: {
  box: Box;
  progress: number;
  text: string;
  color: string;
  textScale: number;
}) {
  const height = box.height;
  const filled = Math.max(height, box.width * Math.max(0, Math.min(1, progress)));
  return (
    <Group x={box.x} y={box.y}>
      <Rect
        width={box.width}
        height={height}
        fill="rgba(0, 0, 0, 0.5)"
        cornerRadius={height / 2}
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth={1}
        {...FAST_SHAPE}
      />
      {progress > 0 && <Rect width={filled} height={height} fill={color} cornerRadius={height / 2} />}
      <Text
        text={text}
        width={box.width}
        height={height + 1}
        fontSize={Math.round(Math.min(16, height - 3) * textScale)}
        fill="white"
        align="center"
        verticalAlign="middle"
        fontStyle="bold"
        fontFamily="Sarabun, Arial"
      />
    </Group>
  );
});

const StatCard = memo(function StatCard({
  box,
  label,
  value,
  accent,
  background = "rgba(15, 23, 42, 0.92)",
  textScale,
}: {
  box: Box;
  label: string;
  value: string;
  accent: string;
  background?: string;
  textScale: number;
}) {
  const inline = box.height < 32;
  return (
    <Group x={box.x} y={box.y}>
      <Rect
        width={box.width}
        height={box.height}
        fill={background}
        stroke={accent}
        strokeWidth={1.5}
        cornerRadius={9}
        {...FAST_SHAPE}
      />
      {inline ? (
        <>
          <Text
            text={label}
            x={7}
            width={box.width - 14}
            height={box.height}
            verticalAlign="middle"
            fontSize={Math.round(10 * textScale)}
            fill="#cbd5e1"
            fontStyle="bold"
            fontFamily="Sarabun, Arial"
          />
          <Text
            text={value}
            x={7}
            width={box.width - 14}
            height={box.height}
            align="right"
            verticalAlign="middle"
            fontSize={Math.round(13 * textScale)}
            fill={accent}
            fontStyle="bold"
            fontFamily="Sarabun, Arial"
          />
        </>
      ) : (
        <>
          <Text
            text={label}
            x={9}
            y={5}
            width={box.width - 18}
            fontSize={Math.round(12 * textScale)}
            fill="#cbd5e1"
            fontStyle="bold"
            fontFamily="Sarabun, Arial"
          />
          <Text
            text={value}
            x={9}
            y={22}
            width={box.width - 18}
            fontSize={Math.round(17 * textScale)}
            fill={accent}
            fontStyle="bold"
            fontFamily="Sarabun, Arial"
          />
        </>
      )}
    </Group>
  );
});

const MessageStrip = memo(function MessageStrip({
  box,
  text,
  color,
  compact,
  textScale,
}: {
  box: Box;
  text: string;
  color: string;
  compact: boolean;
  textScale: number;
}) {
  const fit = useMemo(() => {
    const parts = text.split("\n");
    const maxFontSize = (compact ? 15 : 17) * textScale + (box.height > 90 ? 3 : 0);
    const fits = parts.map((part) =>
      fitText(part, {
        width: box.width - 14,
        // Text with its own line break keeps each part on one line.
        height: parts.length > 1 ? maxFontSize * 1.2 + 1 : box.height - 6,
        maxFontSize,
        minFontSize: 11,
        lineHeight: 1.2,
        fontFamily: "Sarabun, Arial",
        fontStyle: "bold",
      }),
    );
    return { text: fits.map((part) => part.text).join("\n"), fontSize: Math.min(...fits.map((part) => part.fontSize)), lineHeight: 1.2 };
  }, [text, box.width, box.height, compact, textScale]);
  return (
    <Text
      x={box.x + 7}
      y={box.y + 3}
      width={box.width - 14}
      height={box.height - 6}
      text={fit.text}
      fontSize={fit.fontSize}
      lineHeight={fit.lineHeight}
      fill={color}
      align="center"
      verticalAlign="middle"
      fontStyle="bold"
      fontFamily="Sarabun, Arial"
      wrap="none"
    />
  );
});

const LOCK_BAR_HEIGHT = 4;

/** Why the tiles stopped answering: the pair is framed, the board dims, and a bar runs out. */
const LockOverlay = memo(function LockOverlay({
  layout,
  cells,
  wrongStreak,
}: {
  layout: RuneMatchLayout;
  cells: GridPosition[];
  wrongStreak: number;
}) {
  const pad = layout.compact ? 4 : 6;
  return (
    <Group>
      <Rect
        x={layout.gridX - pad}
        y={layout.gridY - pad}
        width={layout.gridWidth + pad * 2}
        height={layout.gridHeight + pad * 2}
        fill="rgba(2, 6, 23, 0.38)"
        cornerRadius={12}
      />
      {cells.map((cell) => {
        const position = cellPosition(layout, cell.row, cell.col);
        return (
          <Rect
            key={`${cell.row}-${cell.col}`}
            x={position.x + 1}
            y={position.y + 1}
            width={layout.cellSize - 2}
            height={layout.cellSize - 2}
            stroke="#ef4444"
            strokeWidth={3}
            cornerRadius={8}
            {...FAST_SHAPE}
          />
        );
      })}
      {wrongStreak >= 2 && (
        <Banner
          layout={layout}
          title="อ่านคำก่อนแตะนะ"
          color="#fecaca"
          fontSize={20}
        />
      )}
    </Group>
  );
});

function Banner({
  layout,
  title,
  subtitle,
  color,
  fontSize,
}: {
  layout: RuneMatchLayout;
  title: string;
  subtitle?: string;
  color: string;
  fontSize: number;
}) {
  const width = Math.min(layout.gridWidth - 16, 320);
  const height = fontSize * 1.5 + (subtitle ? 28 : 0) + 14;
  const x = layout.gridX + (layout.gridWidth - width) / 2;
  const y = layout.gridY + (layout.gridHeight - height) / 2;
  return (
    <Group x={x} y={y}>
      <Rect
        width={width}
        height={height}
        fill="rgba(2, 6, 23, 0.9)"
        stroke={color}
        strokeWidth={2}
        cornerRadius={14}
        {...FAST_SHAPE}
      />
      <Text
        text={title}
        y={7}
        width={width}
        height={fontSize * 1.5}
        align="center"
        verticalAlign="middle"
        fontSize={fontSize}
        fill={color}
        fontStyle="bold"
        fontFamily="Sarabun, Arial"
      />
      {subtitle && (
        <Text
          text={subtitle}
          y={7 + fontSize * 1.5}
          width={width}
          height={26}
          align="center"
          verticalAlign="middle"
          fontSize={17}
          fill="#e2e8f0"
          fontStyle="bold"
          fontFamily="Sarabun, Arial"
        />
      )}
    </Group>
  );
}

const BURST_COLORS = [0, "rgba(255, 255, 255, 0.95)", 0.4, "rgba(125, 211, 252, 0.75)", 1, "rgba(125, 211, 252, 0)"];

/** A glow in the runes' colour over a matched tile, gone in a blink. */
const BurstEffect = memo(function BurstEffect({ burst, layout }: { burst: MatchBurst; layout: RuneMatchLayout }) {
  const nodeRef = useRef<KonvaCircleNode>(null);
  const position = cellPosition(layout, burst.row, burst.col);
  const radius = layout.cellSize * 0.55;
  useEffect(() => {
    nodeRef.current?.to({ scaleX: 1.5, scaleY: 1.5, opacity: 0, duration: 0.26, easing: easeOut });
  }, []);
  return (
    <Circle
      ref={nodeRef}
      name="rune-burst"
      x={position.x + layout.cellSize / 2}
      y={position.y + layout.cellSize / 2}
      radius={radius}
      fillRadialGradientStartRadius={0}
      fillRadialGradientEndRadius={radius}
      fillRadialGradientColorStops={BURST_COLORS}
    />
  );
});

const FLOATER_BOX_WIDTH = 170;
const FLOATER_FONT = 24;

function FloaterText({
  floater,
  layout,
  stageWidth,
}: {
  floater: FloatingText;
  layout: RuneMatchLayout;
  stageWidth: number;
}) {
  const isBoardWide = floater.x === -1;
  // Grid floaters carry a logical cell (x = col, y = row).
  const anchor = isBoardWide
    ? { x: layout.gridX + layout.gridWidth / 2, y: layout.gridY + layout.gridHeight / 2 }
    : (() => {
        const position = cellPosition(layout, floater.y, floater.x);
        return { x: position.x + layout.cellSize / 2, y: position.y + layout.cellSize / 2 };
      })();
  const centerX = clampLabelCenter(anchor.x, FLOATER_BOX_WIDTH * floater.scale, stageWidth);
  return (
    <Text
      text={floater.text}
      x={centerX}
      y={Math.max(FLOATER_FONT, anchor.y + floater.offsetY)}
      width={FLOATER_BOX_WIDTH}
      offsetX={FLOATER_BOX_WIDTH / 2}
      offsetY={FLOATER_FONT / 2}
      fontSize={isBoardWide ? 30 : FLOATER_FONT}
      scaleX={floater.scale}
      scaleY={floater.scale}
      fill={floater.color}
      stroke="#020617"
      strokeWidth={5}
      fillAfterStrokeEnabled
      opacity={floater.opacity}
      fontStyle="bold"
      fontFamily="Sarabun, Arial"
      align="center"
      {...FAST_SHAPE}
    />
  );
}

const TONE_COLOR: Record<"good" | "bad" | "info", string> = {
  good: "#86efac",
  bad: "#fca5a5",
  info: "#bae6fd",
};

export function StatusLayer({
  state,
  layout,
  stageWidth,
  monsterImage,
  monsterLabel,
  timeLabel,
  timeColor,
  timeBackground,
  timeBarText,
  matchesText,
  comboText,
  stripText,
  stripColor,
  targetMatches,
  textScale,
  children,
}: {
  state: RuneMatchState;
  layout: RuneMatchLayout;
  stageWidth: number;
  monsterImage: HTMLImageElement;
  monsterLabel: string;
  timeLabel: string;
  timeColor: string;
  timeBackground: string;
  timeBarText: string;
  matchesText: string;
  comboText: string | null;
  stripText: string;
  stripColor: string;
  targetMatches: number;
  textScale: number;
  children?: React.ReactNode;
}) {
  const lockProgress = state.inputLockTotalMs > 0 ? state.inputLockMs / state.inputLockTotalMs : 0;
  const monster = state.monster;
  return (
    // Nothing here takes taps: the board underneath gets every one.
    <Layer listening={false}>
      {monster && (
        <>
          <Goblin image={monsterImage} box={layout.goblin} pose={state.monsterState} />
          <StatusBar
            box={layout.hpBar}
            progress={monster.hp / monster.maxHp}
            text={monsterLabel}
            color="#ef4444"
            textScale={textScale}
          />
        </>
      )}
      {layout.statCards && (
        <>
          <StatCard
            box={layout.statCards.left}
            label="จับคู่แล้ว"
            value={`${state.correctAnswers}/${targetMatches}`}
            accent="#86efac"
            textScale={textScale}
          />
          <StatCard
            box={layout.statCards.right}
            label="เวลาที่เหลือ"
            value={timeLabel}
            accent={timeColor}
            background={timeBackground}
            textScale={textScale}
          />
        </>
      )}
      {layout.timeBar && (
        <>
          <StatusBar
            box={layout.timeBar}
            progress={state.player.hp / state.player.maxHp}
            text={timeBarText}
            color="#22c55e"
            textScale={textScale}
          />
          <Text
            text={matchesText}
            x={10}
            y={layout.matchesY}
            width={layout.sidebarWidth - 20}
            fontSize={Math.round(16 * textScale)}
            fill="#86efac"
            fontStyle="bold"
            align="center"
            fontFamily="Sarabun, Arial"
          />
          {comboText && layout.comboY !== null && (
            <Text
              text={comboText}
              x={10}
              y={layout.comboY}
              width={layout.sidebarWidth - 20}
              fontSize={Math.round(16 * textScale)}
              fill="#fb923c"
              fontStyle="bold"
              align="center"
              fontFamily="Sarabun, Arial"
            />
          )}
        </>
      )}
      <MessageStrip box={layout.strip} text={stripText} color={stripColor} compact={layout.compact} textScale={textScale} />
      {state.inputLockMs > 0 && (
        <>
          <Rect
            x={layout.strip.x + 4}
            y={layout.strip.y + layout.strip.height - LOCK_BAR_HEIGHT - 2}
            width={Math.max(0, (layout.strip.width - 8) * lockProgress)}
            height={LOCK_BAR_HEIGHT}
            fill="#ef4444"
            cornerRadius={2}
          />
          <LockOverlay layout={layout} cells={state.wrongCells} wrongStreak={state.wrongStreak} />
        </>
      )}
      {state.bursts.map((burst) => (
        <BurstEffect key={burst.id} burst={burst} layout={layout} />
      ))}
      {state.floatingTexts.map((floater) => (
        <FloaterText key={floater.id} floater={floater} layout={layout} stageWidth={stageWidth} />
      ))}
      {state.status === "victory" && (
        <Banner layout={layout} title="ชนะ!" subtitle={`จับคู่ครบ ${state.correctAnswers} คู่`} color="#facc15" fontSize={44} />
      )}
      {state.status === "defeat" && (
        <Banner layout={layout} title="หมดเวลา!" subtitle={`จับคู่ได้ ${state.correctAnswers} คู่`} color="#fca5a5" fontSize={36} />
      )}
      {children}
    </Layer>
  );
}

export const messageColor = (tone: "good" | "bad" | "info") => TONE_COLOR[tone];
