import React, { useEffect, useState } from 'react'
import { Group, Rect, Text, Image as KonvaImage, Line } from 'react-konva'
import { usePotionRushStore, Customer, CustomerType } from '@/store/usePotionRushStore'
import { withBasePath } from '@/lib/games/basePath'

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

export default function CustomerQueue({ y, width }: CustomerQueueProps) {
  const customers = usePotionRushStore(state => state.customers)
  const slotWidth = width / 3

  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})
  const [focusedIndex, setFocusedIndex] = useState<number>(0)

  useEffect(() => {
    const assets = {
      sheet1: withBasePath('/games/sentence/potion-rush/character-sheet-adjusted.png'),
      sheet2: withBasePath('/games/sentence/potion-rush/character-sheet-2-adjusted.png'),
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

  // Create render order: put the focused slot index last so it gets rendered on top in Konva
  const renderOrder = [0, 1, 2]
  if (customers[focusedIndex]) {
    const idx = renderOrder.indexOf(focusedIndex)
    if (idx > -1) {
      renderOrder.splice(idx, 1)
      renderOrder.push(focusedIndex)
    }
  } else {
    // If current focused is empty, find first active and make it last
    const firstActive = customers.findIndex(c => c !== null)
    if (firstActive > -1) {
      const idx = renderOrder.indexOf(firstActive)
      if (idx > -1) {
        renderOrder.splice(idx, 1)
        renderOrder.push(firstActive)
      }
    }
  }

  return (
    <Group y={y}>
        {renderOrder.map((i) => {
             const customer = customers[i]
             if (!customer) return null
             
             return (
                  <SingleCustomer 
                     key={customer.id} 
                     customer={customer} 
                     x={slotWidth * i + slotWidth / 2} 
                     y={0} 
                     sheet={images[CUSTOMER_ASSETS[customer.type].sheetKey]}
                     row={CUSTOMER_ASSETS[customer.type].row}
                     index={i}
                     isFocused={i === focusedIndex}
                     onClick={() => setFocusedIndex(i)}
                  />
             )
        })}
    </Group>
  )
}

function SingleCustomer({ customer, x, y, sheet, row, index, isFocused, onClick }: { 
    customer: Customer, 
    x: number, 
    y: number, 
    sheet: HTMLImageElement | undefined,
    row: number,
    index: number,
    isFocused: boolean,
    onClick: () => void
}) {
    const isAngry = customer.state === 'LEAVING_ANGRY'
    const isHappy = customer.state === 'LEAVING_HAPPY'
    
    const col = isHappy ? 1 : isAngry ? 2 : 0

    const cellW = sheet ? sheet.width / 3 : 300
    const cellH = sheet ? sheet.height / 3 : 300

    const patienceRatio = customer.patience / customer.maxPatience
    const patienceColor = patienceRatio > 0.5 ? '#22c55e' : patienceRatio > 0.2 ? '#facc15' : '#ef4444'

    return (
        <Group x={x} y={y} opacity={isHappy ? 0.5 : 1} onClick={onClick} onTouchStart={onClick}>
            {sheet ? (
                <KonvaImage 
                    image={sheet}
                    x={-100}
                    y={-200}
                    width={200}
                    height={200}
                    crop={{
                        x: col * cellW,
                        y: row * cellH,
                        width: cellW,
                        height: cellH
                    }}
                />
            ) : (
                <Rect width={100} height={150} x={-50} y={-150} fill="#666" cornerRadius={10} />
            )}

            <Group y={-220}>
                <Rect x={-40} width={80} height={10} fill="#333" cornerRadius={5} />
                <Rect x={-40} width={80 * patienceRatio} height={10} fill={patienceColor} cornerRadius={5} />
            </Group>

            <Group 
                x={index === 0 ? 10 : index === 1 ? -80 : -170} 
                y={-180}
            >
                <Rect width={160} height={60} fill="white" stroke="black" strokeWidth={2} cornerRadius={10} />
                {index === 0 && (
                    <Line points={[0, 30, -15, 30, 0, 40]} fill="white" stroke="black" strokeWidth={2} closed tension={0} />
                )}
                {index === 1 && (
                    <Line points={[80, 60, 80, 75, 90, 60]} fill="white" stroke="black" strokeWidth={2} closed tension={0} />
                )}
                {index === 2 && (
                    <Line points={[160, 30, 175, 30, 160, 40]} fill="white" stroke="black" strokeWidth={2} closed tension={0} />
                )}
                <Text 
                    text={customer.request.translation} 
                    width={150} 
                    align="center" 
                    y={15} 
                    x={5}
                    fontSize={16} 
                    fontStyle="bold"
                    fill="black"
                />
            </Group>
        </Group>
    )
}
