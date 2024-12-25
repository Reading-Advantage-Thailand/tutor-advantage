"use client"

import React from "react"
import dynamic from "next/dynamic"

const ClassesProvider = dynamic(() => import("./classes-provider"), {
  ssr: false,
})

export default function TutorChannelsPage() {
  return <ClassesProvider />
}
