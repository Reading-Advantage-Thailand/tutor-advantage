"use client"

import { useErrorStore } from "@/lib/base-error"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"

export default function GlobalError() {
  const { error, resetError } = useErrorStore()

  if (!error) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <Icons.close className="text-red-500 size-12 mb-4" />
        <h2 className="text-xl font-semibold">An error occurred</h2>
        <p className="text-gray-500 mt-2">{error.message}</p>

        <div className="mt-4">
          <Button
            onClick={resetError}
            className="bg-blue-500 hover:bg-blue-600"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}