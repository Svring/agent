"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface VectorDialogProps {
  vector: any
  children: React.ReactNode
}

export function VectorDialog({ vector, children }: VectorDialogProps) {
  const [open, setOpen] = React.useState(false)
  
  // Format vector for display
  const formatVector = () => {
    if (Array.isArray(vector)) {
      return (
        <div className="grid grid-cols-4 gap-2">
          {vector.map((value, index) => (
            <div key={index} className="bg-muted p-1 rounded text-xs">
              [{index}]: {typeof value === 'number' ? value.toFixed(6) : String(value)}
            </div>
          ))}
        </div>
      )
    } else if (typeof vector === 'object' && vector !== null) {
      return (
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(vector).map(([key, value]) => (
            <div key={key} className="bg-muted p-1 rounded text-xs">
              {key}: {typeof value === 'number' ? (value as number).toFixed(6) : String(value)}
            </div>
          ))}
        </div>
      )
    } else {
      return <div>Vector data is not in expected format</div>
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="p-0 h-auto font-normal text-current">
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vector Data</DialogTitle>
          <DialogDescription>
            The full content of the embedding vector
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-4">
            {formatVector()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 