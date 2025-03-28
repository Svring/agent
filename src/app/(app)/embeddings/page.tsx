import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { columns } from './columns'
import { DataTable } from './data-table'

export default async function EmbeddingsPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  // Fetch embeddings data
  const embeddingsResponse = await payload.find({
    collection: 'embeddings',
    depth: 1, // Include related documents (textId)
  })

  const embeddings = embeddingsResponse.docs || []

  return (
    <div className="container py-10 mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Embeddings Collection</CardTitle>
          <CardDescription>
            Displaying {embeddings.length} vector embeddings from the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {embeddings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground mb-4">No embeddings found in the database.</p>
            </div>
          ) : (
            <DataTable columns={columns} data={embeddings} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
