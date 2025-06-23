"use client"

import ClassCreationForm from "./class-creation-form"

export default function TutorClassCreationPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <ClassCreationForm />
      </div>
    </div>
  )
}