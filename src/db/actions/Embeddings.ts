import { getPayload } from 'payload'
import config from '@payload-config'
import { openai } from '@ai-sdk/openai'
import { embed, embedMany } from 'ai'
import { sql, gt, desc, cosineDistance } from 'drizzle-orm'

const payload = await getPayload({ config })

// OpenAI embedding model
const embeddingModel = openai.embedding('text-embedding-ada-002')

// Generate text chunks for embedding
const generateChunks = (input: string): string[] => {
  return input
    .trim()
    .split('.')
    .filter(i => i !== '')
}

// Generate embeddings for all chunks of text
export const generateEmbeddings = async (
  value: string
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value)
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  })
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }))
}

// Generate a single embedding for text
export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll('\\n', ' ')
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  })
  return embedding
}

// Store embeddings for a text document
export const storeEmbeddings = async (textId: number, content: string) => {
  try {
    const embeddingsArray = await generateEmbeddings(content)
    
    // Create embedding documents in PayloadCMS
    const promises = embeddingsArray.map(async ({ content, embedding }) => {
      await payload.create({
        collection: 'embeddings',
        data: {
          content,
          embedding,
          textId,
        },
      })
    })
    
    await Promise.all(promises)
    
    return 'Embeddings successfully created.'
  } catch (error) {
    console.error('Error creating embeddings:', error)
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error creating embeddings, please try again.'
  }
}

// Find relevant content based on similarity
export const findRelevantContent = async (userQuery: string) => {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(userQuery)
    
    // Use direct database access with cosineDistance
    const similarity = sql<number>`1 - (${cosineDistance(
      payload.db.tables.embeddings.embedding, 
      queryEmbedding
    )})`

    // Query using drizzle with similarity sorting
    const results = await payload.db.drizzle
      .select({
        content: payload.db.tables.embeddings.content,
        textId: payload.db.tables.embeddings.textId,
        similarity
      })
      .from(payload.db.tables.embeddings)
      .where(gt(similarity, 0.5))
      .orderBy(desc(similarity))
      .limit(4)
    
    return results
    
  } catch (error) {
    console.error('Error finding relevant content:', error)
    return []
  }
}
