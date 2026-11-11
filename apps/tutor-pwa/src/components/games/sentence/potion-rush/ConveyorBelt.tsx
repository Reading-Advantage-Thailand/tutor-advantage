import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type Konva from 'konva'
import { Group, Rect, Text, Image as KonvaImage, Circle } from 'react-konva'
import { usePotionRushStore, Ingredient } from '@/store/usePotionRushStore'
import { useGameImages } from '@/lib/games/useGameImages'
import { useSound } from '@/hooks/useSound'
import { resolveDropZone, type DropZoneLayout } from '@/lib/games/potionRushOrders'

const BELT_IMAGES = {
  herb: '/games/sentence/potion-rush/herb.webp',
  mineral: '/games/sentence/potion-rush/mineral.webp',
  mushroom: '/games/sentence/potion-rush/mushroom.webp',
  potion: '/games/sentence/potion-rush/potion.webp',
}

const HOLD_SLOT_Y = 510
const ROLLER_SPACING = 100
const LABEL_FONT_SIZE = 16
const LABEL_HEIGHT = 22
const MISSED_DROP_HINT = 'วางลงในหม้อ'

interface ConveyorBeltProps {
  y: number
  width: number
  layout: DropZoneLayout & { cauldronY: number }
  /** Above 1 on a projected stage. Phones never set this. */
  labelScale?: number
}

let measureContext: CanvasRenderingContext2D | null = null

/** Width of a belt label as Konva will draw it. */
function labelWidth(word: string, fontSize: number): number {
  if (typeof document === 'undefined') return word.length * fontSize * 0.56
  measureContext = measureContext ?? document.createElement('canvas').getContext('2d')
  if (!measureContext) return word.length * fontSize * 0.56
  measureContext.font = `bold ${fontSize}px Arial`
  return measureContext.measureText(word).width
}

function potCentre(slot: number, width: number, cauldronY: number) {
  return { x: (width / 3) * (slot + 0.5), y: cauldronY - 20 }
}

export default function ConveyorBelt({ y, width, layout, labelScale = 1 }: ConveyorBeltProps) {
  // Only the list of words re-renders. Positions change every frame and are set on the nodes directly.
  const itemIds = usePotionRushStore(state => state.conveyorItems.map(item => item.id).join(','))
  const items = useMemo(
    () => usePotionRushStore.getState().conveyorItems,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemIds],
  )

  const { images } = useGameImages(BELT_IMAGES)
  const nodesRef = useRef(new Map<string, Konva.Group>())
  const rollersRef = useRef<Konva.Group | null>(null)
  const heldY = HOLD_SLOT_Y - y

  useEffect(() => {
    let lastGameTime = usePotionRushStore.getState().gameTime
    let rollerOffset = 0

    const place = (state: ReturnType<typeof usePotionRushStore.getState>) => {
      const elapsed = Math.max(0, state.gameTime - lastGameTime)
      lastGameTime = state.gameTime
      rollerOffset = (rollerOffset + state.beltSpeed * elapsed) % ROLLER_SPACING
      rollersRef.current?.x(-rollerOffset)

      state.conveyorItems.forEach(item => {
        const node = nodesRef.current.get(item.id)
        if (!node || item.isDragging || node.isDragging()) return
        node.position({ x: item.x, y: item.isHeld ? heldY : 0 })
      })
      rollersRef.current?.getLayer()?.batchDraw()
    }

    place(usePotionRushStore.getState())
    return usePotionRushStore.subscribe(place)
  }, [heldY])

  const handleDrop = (item: Ingredient, itemCentre: { x: number; y: number }, finger: { x: number; y: number }) => {
    const store = usePotionRushStore.getState()
    const zone = resolveDropZone(itemCentre, finger, width, layout)
    switch (zone.kind) {
      case 'trash':
        return store.discardIngredient(item.id)
      case 'hold':
        return store.handleHoldIngredient(item.id, zone.slot, width)
      case 'belt':
        return store.releaseHold(item.id)
      case 'pot':
        return store.handleDropIngredient(zone.slot, item.id, potCentre(zone.slot, width, layout.cauldronY))
      case 'none':
        return store.showHint(MISSED_DROP_HINT)
    }
  }

  const dragTargetAt = (itemCentre: { x: number; y: number }, finger: { x: number; y: number }) => {
    const zone = resolveDropZone(itemCentre, finger, width, layout)
    usePotionRushStore.getState().setDragTargetSlot(zone.kind === 'pot' ? zone.slot : null)
  }

  return (
    <Group y={y}>
        <Rect
            width={width}
            height={80}
            fill="#333"
            stroke="#111"
            strokeWidth={4}
            listening={false}
        />

        <Group ref={rollersRef} listening={false}>
          {Array.from({ length: Math.ceil(width / ROLLER_SPACING) + 2 }).map((_, i) => (
              <Circle
                  key={i}
                  x={i * ROLLER_SPACING + 50}
                  y={40}
                  radius={8}
                  fill="#555"
              />
          ))}
        </Group>

        {items.map(item => (
            <IngredientItem
                key={item.id}
                item={item}
                nodes={nodesRef.current}
                beltY={y}
                heldY={heldY}
                images={images}
                labelScale={labelScale}
                onDragMove={dragTargetAt}
                onDrop={handleDrop}
            />
        ))}
    </Group>
  )
}

function IngredientItem({ item, nodes, beltY, heldY, images, labelScale, onDragMove, onDrop }: {
    item: Ingredient,
    nodes: Map<string, Konva.Group>,
    beltY: number,
    heldY: number,
    images: Record<string, HTMLImageElement>,
    labelScale: number,
    onDragMove: (itemCentre: { x: number; y: number }, finger: { x: number; y: number }) => void,
    onDrop: (item: Ingredient, itemCentre: { x: number; y: number }, finger: { x: number; y: number }) => void,
}) {
    const { playSound } = useSound()
    const img = images[item.type]
    const groupRef = useRef<Konva.Group | null>(null)
    const fontSize = LABEL_FONT_SIZE * labelScale
    const boxWidth = useMemo(() => Math.ceil(labelWidth(item.word, fontSize)) + 12, [item.word, fontSize])

    useLayoutEffect(() => {
        const node = groupRef.current
        if (!node) return
        const current = usePotionRushStore.getState().conveyorItems.find(i => i.id === item.id)
        node.position({ x: current?.x ?? item.x, y: current?.isHeld ? heldY : 0 })
        nodes.set(item.id, node)
        return () => {
            nodes.delete(item.id)
        }
    // Mounted once per word: the belt moves the node after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id])

    const dragPoints = (e: Konva.KonvaEventObject<DragEvent>) => {
        const stage = e.target.getStage()
        const pointer = stage?.getPointerPosition()
        if (!pointer || !stage) return null
        const scale = stage.scaleX()
        const stagePos = stage.position()
        return {
            itemCentre: { x: e.target.x(), y: e.target.y() + beltY },
            finger: { x: (pointer.x - stagePos.x) / scale, y: (pointer.y - stagePos.y) / scale },
        }
    }

    return (
        <Group
            ref={groupRef}
            draggable
            onDragStart={() => {
                playSound('clinking')
                usePotionRushStore.getState().setIngredientDragging(item.id, true)
            }}
            onDragMove={(e) => {
                const points = dragPoints(e)
                if (points) onDragMove(points.itemCentre, points.finger)
            }}
            onDragEnd={(e) => {
                const points = dragPoints(e)
                const store = usePotionRushStore.getState()
                store.setDragTargetSlot(null)
                store.setIngredientDragging(item.id, false)
                if (points) onDrop(item, points.itemCentre, points.finger)
            }}
        >
            {img ? (
                <KonvaImage
                    image={img}
                    x={-40}
                    y={-40}
                    width={80}
                    height={80}
                />
            ) : (
                <Rect width={40} height={40} x={-20} y={-20} fill="#fff" />
            )}

            <Group y={40}>
                <Rect
                    x={-boxWidth / 2}
                    width={boxWidth}
                    height={LABEL_HEIGHT * labelScale}
                    fill="rgba(0,0,0,0.75)"
                    cornerRadius={4}
                />
                <Text
                    text={item.word}
                    fill="white"
                    fontSize={fontSize}
                    fontStyle="bold"
                    align="center"
                    x={-boxWidth / 2}
                    width={boxWidth}
                    y={3 * labelScale}
                />
            </Group>
        </Group>
    )
}
