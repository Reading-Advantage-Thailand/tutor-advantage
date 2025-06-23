'use client'

import React, { useState, useEffect } from 'react'
import { Apple, icons } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

const Icon = ({ onSelect }: { onSelect: (iconName: string) => void }) => {
  const [search, setSearch] = useState('')
  const [filteredIcons, setFilteredIcons] = useState(Object.keys(icons))

  useEffect(() => {
    setFilteredIcons(
      Object.keys(icons).filter(iconName =>
        iconName.toLowerCase().includes(search.toLowerCase())
      )
    )
  }, [search])

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="text"
        placeholder="ค้นหาไอคอน..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="sticky top-0"
      />
      <ScrollArea className="h-72 w-full rounded-md border">
        <div className="grid grid-cols-8 gap-1 p-2">
          {filteredIcons.map(iconName => {
            const LucideIcon = icons[iconName as keyof typeof icons]
            return (
              <Tooltip key={iconName}>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className='hover:bg-accent/50 cursor-pointer' onClick={() => onSelect(iconName)}>
                    <LucideIcon size={20} onClick={() => onSelect(iconName)} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{iconName.replace(/([A-Z])/g, ' $1').trim()}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

interface IconSelectorProps {
  onSelect?: (iconName: string) => void
  value?: string
}

export const IconSelector = ({ onSelect, value }: IconSelectorProps) => {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(value || null)
  const [open, setOpen] = useState(false)

  const handleSelect = (iconName: string) => {
    setSelectedIcon(iconName)
    setOpen(false)
    onSelect?.(iconName)
  }

  return (
    <div className="flex flex-row items-center gap-2">
      <div className={buttonVariants({ variant: 'secondary' })}>
        {selectedIcon ? React.createElement(icons[selectedIcon as keyof typeof icons]) : <Apple size={16} />}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className='flex-1 hover:bg-accent/50 cursor-pointer'>
            {selectedIcon ? (
              `${selectedIcon}`.replace(/([A-Z])/g, ' $1').trim()
            ) : (
              'เลือกไอคอน'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-96">
          <Icon onSelect={handleSelect} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
