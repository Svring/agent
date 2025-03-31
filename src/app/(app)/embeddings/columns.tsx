"use client"

import { ColumnDef } from "@tanstack/react-table"
import { VectorDialog } from "./vector-dialog"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

// Define the shape of our embeddings data
export type Embedding = {
  id: number
  content: string
  sourceText: any  // Changed from textId to sourceText to match payload schema
  embedding: any  // Vector data (array or object)
  createdAt: string
  updatedAt: string
}

// Delete embedding function
async function deleteEmbedding(id: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/embeddings?id=${id}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Delete error:', data.message, data.error);
      return false;
    }
    
    return data.success;
  } catch (error) {
    console.error('Network error deleting embedding:', error);
    return false;
  }
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
      const textContent = typeof embedding.sourceText === 'object' && embedding.sourceText !== null
        ? embedding.sourceText.content
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
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const embedding = row.original
      const [isDeleting, setIsDeleting] = useState(false)
      
      const handleDelete = async () => {
        setIsDeleting(true)
        try {
          await deleteEmbedding(embedding.id)
          // Refresh the page to update the list
          window.location.reload()
        } catch (error) {
          console.error('Error deleting embedding:', error)
        } finally {
          setIsDeleting(false)
        }
      }
      
      return (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete embedding"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-red-500" />
          )}
        </Button>
      )
    },
  },
]
