import React from 'react'
import { Circle, Group, Rect, Text, Image as KonvaImage } from 'react-konva'
import { usePotionRushStore, CustomerType } from '@/store/usePotionRushStore'
import { useGameImages } from '@/lib/games/useGameImages'
import { orderWords } from '@/lib/games/potionRushOrders'

const CUSTOMER_IMAGES = {
  sheet1: '/games/sentence/potion-rush/character-sheet-adjusted.webp',
  sheet2: '/games/sentence/potion-rush/character-sheet-2-adjusted.webp',
}

interface CustomerQueueProps {
  y: number
  width: number
}

const CUSTOMER_ASSETS: Record<CustomerType, { sheetKey: 'sheet1' | 'sheet2', row: number }> = {
    orc: { sheetKey: 'sheet1', row: 0 },
    elf: { sheetKey: 'sheet1', row: 1 },
    wizard: { sheetKey: 'sheet1', row: 2 },
    dwarf: { sheetKey: 'sheet2', row: 0 },
    goblin: { sheetKey: 'sheet2', row: 1 },
    human: { sheetKey: 'sheet2', row: 2 },
    skeleton: { sheetKey: 'sheet1', row: 0 }
}

// The bar moves in steps, so waiting customers do not redraw the counter every frame.
const PATIENCE_STEPS = 40
// The sheets are not cut exactly in thirds: a little of the next row shows as a thin line otherwise.
const CROP_INSET = 0.015

export default function CustomerQueue({ y, width }: CustomerQueueProps) {
  const slotWidth = width / 3
  const { images } = useGameImages(CUSTOMER_IMAGES)

  return (
    <Group y={y}>
      {[0, 1, 2].map((slot) => (
        <CustomerSlot key={slot} slot={slot} x={slotWidth * slot + slotWidth / 2} slotWidth={slotWidth} images={images} />
      ))}
    </Group>
  )
}

function CustomerSlot({ slot, x, slotWidth, images }: {
    slot: number,
    x: number,
    slotWidth: number,
    images: Record<string, HTMLImageElement>
}) {
    const customerId = usePotionRushStore(state => state.customers[slot]?.id ?? null)
    if (!customerId) return null
    return <SingleCustomer key={customerId} slot={slot} x={x} slotWidth={slotWidth} images={images} />
}

function SingleCustomer({ slot, x, slotWidth, images }: {
    slot: number,
    x: number,
    slotWidth: number,
    images: Record<string, HTMLImageElement>
}) {
    const type = usePotionRushStore(state => state.customers[slot]?.type ?? 'human')
    const customerState = usePotionRushStore(state => state.customers[slot]?.state ?? 'WAITING')
    const term = usePotionRushStore(state => state.customers[slot]?.request.term ?? '')
    const patienceStep = usePotionRushStore(state => {
        const customer = state.customers[slot]
        return customer ? Math.ceil((customer.patience / customer.maxPatience) * PATIENCE_STEPS) : 0
    })
    const placedWords = usePotionRushStore(state => state.cauldrons[slot]?.currentWords.length ?? 0)
    const isFocused = usePotionRushStore(state => state.focusedSlot === slot)
    const setFocusedSlot = usePotionRushStore(state => state.setFocusedSlot)

    const { sheetKey, row } = CUSTOMER_ASSETS[type]
    const sheet = images[sheetKey]
    const isAngry = customerState === 'LEAVING_ANGRY'
    const isHappy = customerState === 'LEAVING_HAPPY'
    const isWaiting = customerState === 'WAITING'

    const col = isHappy ? 1 : isAngry ? 2 : 0

    const cellW = sheet ? sheet.width / 3 : 300
    const cellH = sheet ? sheet.height / 3 : 300

    const patienceRatio = patienceStep / PATIENCE_STEPS
    const patienceColor = patienceRatio > 0.5 ? '#22c55e' : patienceRatio > 0.2 ? '#facc15' : '#ef4444'
    const totalWords = orderWords(term).length
    const focus = () => setFocusedSlot(slot)

    return (
        <Group x={x} opacity={isHappy ? 0.5 : 1} onClick={focus} onTap={focus}>
            {isFocused && isWaiting && (
                <Circle y={-96} radius={64} fill="rgba(251, 191, 36, 0.22)" stroke="#fbbf24" strokeWidth={3} listening={false} />
            )}

            {sheet ? (
                <KonvaImage
                    image={sheet}
                    x={-100}
                    y={-200}
                    width={200}
                    height={200}
                    listening={false}
                    crop={{
                        x: col * cellW,
                        y: (row + CROP_INSET) * cellH,
                        width: cellW,
                        height: (1 - 2 * CROP_INSET) * cellH
                    }}
                />
            ) : (
                <Rect width={100} height={150} x={-50} y={-150} fill="#666" cornerRadius={10} listening={false} />
            )}

            {/* The sprites overlap their neighbours, so tapping goes by column. */}
            <Rect x={-slotWidth / 2} y={-200} width={slotWidth} height={200} fill="transparent" />

            {isWaiting && (
                <Group y={-40} listening={false}>
                    <Rect
                        x={-26}
                        width={52}
                        height={22}
                        fill="rgba(15, 23, 42, 0.88)"
                        stroke={isFocused ? '#fbbf24' : 'rgba(255, 255, 255, 0.45)'}
                        strokeWidth={2}
                        cornerRadius={11}
                    />
                    <Text
                        text={`${placedWords}/${totalWords}`}
                        x={-26}
                        y={4}
                        width={52}
                        align="center"
                        fontSize={14}
                        fontStyle="bold"
                        fill="white"
                    />
                    <Rect x={-40} y={27} width={80} height={8} fill="#1f2937" cornerRadius={4} />
                    <Rect x={-40} y={27} width={80 * patienceRatio} height={8} fill={patienceColor} cornerRadius={4} />
                </Group>
            )}
        </Group>
    )
}
