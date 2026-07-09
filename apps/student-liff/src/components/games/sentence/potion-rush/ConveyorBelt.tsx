import React, { useEffect, useRef, useState } from 'react'
import { Group, Rect, Text, Image as KonvaImage, Circle } from 'react-konva'
import { usePotionRushStore, Ingredient } from '@/store/usePotionRushStore'
import { withBasePath } from '@/lib/games/basePath'
import { useSound } from '@/hooks/useSound'

interface LayoutConfig {
  cauldronY: number
  trashX: number
  trashY: number
}

interface ConveyorBeltProps {
  y: number
  width: number
  dragBoundFunc: (pos: { x: number; y: number }) => { x: number; y: number }
  layout: LayoutConfig
}

export default function ConveyorBelt({ y, width, layout }: ConveyorBeltProps) {
  const items = usePotionRushStore(state => state.conveyorItems)
  const handleDrop = usePotionRushStore(state => state.handleDropIngredient)
  const discardIngredient = usePotionRushStore(state => state.discardIngredient)
  const setIngredientDragging = usePotionRushStore(state => state.setIngredientDragging)
  const handleHold = usePotionRushStore(state => state.handleHoldIngredient)
  const releaseHold = usePotionRushStore(state => state.releaseHold)
  const gameState = usePotionRushStore(state => state.gameState)
  const beltSpeed = usePotionRushStore(state => state.beltSpeed)
  
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})
  const [beltOffset, setBeltOffset] = useState(0)
  const lastFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const assets = {
      herb: withBasePath('/games/sentence/potion-rush/herb.png'),
      mineral: withBasePath('/games/sentence/potion-rush/mineral.png'),
      mushroom: withBasePath('/games/sentence/potion-rush/mushroom.png'),
      potion: withBasePath('/games/sentence/potion-rush/potion.png'),
    }
    const loadedImgs: Record<string, HTMLImageElement> = {}
    let count = 0
    const sources = Object.entries(assets)
    sources.forEach(([key, src]) => {
      const img = new window.Image()
      img.src = src
      img.onload = () => {
        loadedImgs[key] = img
        count++
        if (count === sources.length) setImages(loadedImgs)
      }
    })
  }, [])

  useEffect(() => {
    if (gameState !== 'PLAYING') {
      lastFrameRef.current = null
      return
    }

    let frameId: number
    const spacing = 100

    const loop = (time: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = time
      }
      const dt = (time - lastFrameRef.current) / 1000
      lastFrameRef.current = time
      setBeltOffset(prev => (prev + beltSpeed * dt) % spacing)
      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [gameState, beltSpeed])

  const checkDropZone = (x: number, y: number, item: Ingredient) => {
      const stationWidth = width / 3
      const cauldronY = layout.cauldronY
      const cauldronHeight = 150
      
      const trashDist = Math.sqrt(Math.pow(x - layout.trashX, 2) + Math.pow(y - layout.trashY, 2))
      if (trashDist < 55) {
          discardIngredient(item.id)
          return
      }

      // Check if dropped in holding slots (Y between 460 and 560)
      if (y > 460 && y < 560) {
          const slotIndex = Math.floor(x / stationWidth)
          if (slotIndex >= 0 && slotIndex <= 2) {
              handleHold(item.id, slotIndex)
              return
          }
      }

      // Check if dropped back on conveyor belt (Y >= 670)
      if (y >= 670) {
          releaseHold(item.id)
          return
      }

      if (y > cauldronY - 50 && y < cauldronY + cauldronHeight + 50) {
          if (x < stationWidth) return handleDrop(0, item.id, { x, y })
          if (x < stationWidth * 2) return handleDrop(1, item.id, { x, y })
          return handleDrop(2, item.id, { x, y })
      }
  }

  return (
    <Group y={y}>
        <Rect 
            width={width} 
            height={80} 
            fill="#333" 
            stroke="#111"
            strokeWidth={4}
        />
        
        {Array.from({ length: Math.ceil(width / 100) + 2 }).map((_, i) => (
            <Circle 
                key={i} 
                x={i * 100 + 50 - beltOffset} 
                y={40} 
                radius={8} 
                fill="#555" 
            />
        ))}

        {items.map(item => (
            <IngredientItem 
                key={item.id} 
                item={item} 
                onDrop={checkDropZone}
                images={images}
                onDragStateChange={setIngredientDragging}
                heldYOffset={510 - y}
            />
        ))}
    </Group>
  )
}

function IngredientItem({ item, onDrop, images, onDragStateChange, heldYOffset }: { 
    item: Ingredient, 
    onDrop: (x: number, y: number, item: Ingredient) => void,
    images: Record<string, HTMLImageElement>;
    onDragStateChange: (ingredientId: string, isDragging: boolean) => void;
    heldYOffset: number;
}) {
    const { playSound } = useSound()
    const [isDragging, setIsDragging] = React.useState(false)
    const [dragPosition, setDragPosition] = React.useState<{ x: number; y: number } | null>(null)
    const img = images[item.type]
    const groupRef = useRef<any>(null)

    const renderX = isDragging && dragPosition ? dragPosition.x : item.x
    const renderY = isDragging && dragPosition ? dragPosition.y : (item.isHeld ? heldYOffset : 0)

    useEffect(() => {
        if (!isDragging && groupRef.current) {
            groupRef.current.x(item.x)
            groupRef.current.y(item.isHeld ? heldYOffset : 0)
        }
    }, [isDragging, item.x, item.isHeld, heldYOffset])

    return (
        <Group
            ref={groupRef}
            x={renderX}
            y={renderY} 
            draggable
            onDragStart={(e) => {
                playSound('clinking')
                setIsDragging(true)
                setDragPosition({ x: e.target.x(), y: e.target.y() })
                onDragStateChange(item.id, true)
            }}
            onDragMove={(e) => {
                setDragPosition({ x: e.target.x(), y: e.target.y() })
            }}
            onDragEnd={(e) => {
                setIsDragging(false)
                setDragPosition(null)
                onDragStateChange(item.id, false)
                const stage = e.target.getStage()
                const pointer = stage?.getPointerPosition()
                if (pointer && stage) {
                    const scale = stage.scaleX()
                    const stagePos = stage.position()
                    const virtualX = (pointer.x - stagePos.x) / scale
                    const virtualY = (pointer.y - stagePos.y) / scale
                    onDrop(virtualX, virtualY, item)
                }
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
                    x={-item.word.length * 4 - 5}
                    width={item.word.length * 8 + 10}
                    height={20}
                    fill="rgba(0,0,0,0.7)"
                    cornerRadius={4}
                />
                <Text 
                    text={item.word} 
                    fill="white" 
                    fontSize={16} 
                    fontStyle="bold"
                    align="center"
                    x={-item.word.length * 4}
                    y={2}
                />
            </Group>
        </Group>
    )
}
