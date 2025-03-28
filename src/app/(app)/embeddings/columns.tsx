"use client"

import { ColumnDef } from "@tanstack/react-table"
import { VectorDialog } from "./vector-dialog"

// Define the shape of our embeddings data
export type Embedding = {
  id: number
  content: string
  textId: any  // Can be number or object with content property
  embedding: any  // Vector data (array or object)
  createdAt: string
  updatedAt: string
}

export const columns: ColumnDef<Embedding>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "content",
    header: "Content",
    cell: ({ row }) => (
      <div className="max-w-md truncate">
        {row.getValue("content")}
      </div>
    ),
  },
  {
    id: "textReference",
    header: "Text Reference",
    cell: ({ row }) => {
      const embedding = row.original
      const textContent = typeof embedding.textId === 'object' && embedding.textId !== null
        ? embedding.textId.content
        : 'Unknown Text'
      
      return (
        <div className="max-w-md truncate">
          {textContent}
        </div>
      )
    },
  },
  {
    id: "vectorSize",
    header: "Vector Size",
    cell: ({ row }) => {
      const embedding = row.original
      const vectorSize = Array.isArray(embedding.embedding) 
        ? embedding.embedding.length 
        : typeof embedding.embedding === 'object' && embedding.embedding !== null
          ? Object.keys(embedding.embedding).length
          : 0
      
      return (
        <VectorDialog vector={embedding.embedding}>
          <span className="cursor-pointer hover:underline">
            {vectorSize} dimensions
          </span>
        </VectorDialog>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"))
      return date.toLocaleString()
    },
  },
]
