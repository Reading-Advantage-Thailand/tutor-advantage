"use client"

import React, { Fragment } from "react"

export default function BackgroundGradient() {
  return (
    <Fragment>
      <div
        className="absolute left-0 -top-[80rem] w-full h-[112rem] -skew-y-[8deg] z-[-3]"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, #6ee7b7, #ec4899, #FFEB3B)",
          backgroundSize: "200% 200%",
          animation: "radialFlow 12s ease infinite",
        }}
      />
      <style jsx global>{`
        @keyframes radialFlow {
          0%,
          100% {
            background-position: 50% 50%;
          }
          25% {
            background-position: 0% 100%;
          }
          50% {
            background-position: 100% 50%;
          }
          75% {
            background-position: 0% 0%;
          }
        }
      `}</style>
    </Fragment>
  )
}
