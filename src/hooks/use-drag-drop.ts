'use client'

import { useState, useCallback, type DragEvent } from 'react'
import { useUploadAttachment } from '@/hooks/use-data'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface UseDragDropOptions {
  eventId: string
  onUploaded?: () => void
}

export function useDragDrop({ eventId, onUploaded }: UseDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const uploadMut = useUploadAttachment()

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) {
        toast.error('Only image files are supported')
        return
      }
      if (images.length > 5) {
        toast.error('Max 5 images at a time')
        return
      }
      images.forEach((file) => {
        uploadMut.mutate(
          { eventId, file },
          {
            onSuccess: () => toast.success(`Photo "${file.name}" attached`),
            onError: (err) => toast.error(err.message),
          },
        )
      })
      onUploaded?.()
    },
    [eventId, uploadMut, onUploaded],
  )

  return {
    isDragging,
    dragHandlers: { onDragOver, onDragLeave, onDrop },
    dropzoneClassName: cn(
      'transition-all',
      isDragging && 'ring-2 ring-emerald-500 ring-offset-2 scale-[1.02]',
    ),
  }
}
