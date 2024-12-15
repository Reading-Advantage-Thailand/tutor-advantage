import Class from '@/components/shared/tutor/class'
import React from 'react'

type Props = {}

export default function TutorClassesPage({}: Props) {
  return (
    <div className='grid md:grid-cols-2 gap-4'>
      <Class />
      <Class />
      <Class />
      <Class />
    </div>
  )
}