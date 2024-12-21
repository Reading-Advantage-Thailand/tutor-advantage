import React from "react"

import CardNews from "@/components/tutor/card-news"
import CardTutorial from "@/components/tutor/card-tutorial"
import CardWelcome from "@/components/tutor/card-welcome"
import FloatingInputMessage from "@/components/tutor/floating-input-message"

export default function TutorGeneralPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-[10rem]">
      <div className="max-w-3xl mx-auto w-full">
        <CardWelcome />
      </div>
      <div className="max-w-3xl mx-auto w-full">
        <CardTutorial />
      </div>
      <div className="max-w-3xl mx-auto w-full">
        <CardNews />
      </div>
      <FloatingInputMessage />
    </div>
  )
}