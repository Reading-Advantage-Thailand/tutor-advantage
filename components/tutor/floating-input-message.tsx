import React from "react"
import { SendHorizonal } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "../ui/button"
import { Input } from "../ui/input"

interface FloatingInputMessageProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSend: () => void
  isRightSidebarOpen?: boolean
}

export default function FloatingInputMessage({
  value,
  onChange,
  onSend,
  isRightSidebarOpen = false,
}: FloatingInputMessageProps) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-0 right-0 px-4 md:ml-[16rem]",
        isRightSidebarOpen && "md:mr-[16rem]"
      )}
    >
      <div className="max-w-4xl mx-auto w-full">
        <div className="border bg-background shadow-lg rounded-xl flex items-center space-x-2 p-3">
          <Input
            type="text"
            placeholder="Type your message..."
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown} // Handle Enter key
            className="flex-1 border-none focus:ring-0"
          />
          <Button type="button" onClick={onSend}>
            <SendHorizonal className="size-4 mr-2" />
            Send Message
          </Button>
        </div>
      </div>
    </div>
  )
}
