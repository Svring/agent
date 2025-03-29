import { getPayload } from 'payload'
import config from '@payload-config'
import { openai } from '@ai-sdk/openai'
import { embed, embedMany } from 'ai'

const payload = await getPayload({ config })

// OpenAI embedding model
const embeddingModel = openai.embedding('text-embedding-3-small')

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

// Helper function to compute cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (normA === 0 || normB === 0) {
    return 0; // Avoid division by zero
  }

  return dotProduct / (normA * normB);
}

export const findRelevantContent = async (userQuery: string) => {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(userQuery);

    // Fetch all embeddings from the database
    const allEmbeddings = await payload.db.drizzle
      .select({
        content: payload.db.tables.embeddings.content,
        embedding: payload.db.tables.embeddings.embedding,
      })
      .from(payload.db.tables.embeddings);

    // Compute similarity for each embedding
    const results = allEmbeddings.map((item) => {
      // Convert jsonb embedding (stored as JSON string or array) to number[]
      const dbEmbedding = Array.isArray(item.embedding)
        ? item.embedding
        : JSON.parse(item.embedding as string);

      // Ensure it's a number[]
      if (!Array.isArray(dbEmbedding) || !dbEmbedding.every((v) => typeof v === 'number')) {
        throw new Error('Invalid embedding format in database');
      }

      // Compute cosine similarity (1 - cosine distance)
      const similarity = cosineSimilarity(queryEmbedding, dbEmbedding);

      return {
        content: item.content,
        similarity,
      };
    });

    // Filter and sort results
    const similarGuides = results
      .filter((result) => result.similarity > 0.5) // Threshold
      .sort((a, b) => b.similarity - a.similarity) // Descending order
      .slice(0, 4); // Limit to top 4

    console.log('for query: ', userQuery, 'relevant info are: ', similarGuides);

    return similarGuides;
  } catch (error) {
    console.error('Error finding relevant content:', error);
    return [];
  }
};
