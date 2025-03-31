import { getPayload } from 'payload'
import config from '@payload-config'
import { storeEmbeddings } from './Embeddings'

const payload = await getPayload({ config })

export const createText = async (content: string, applicationId: number) => {
  try {
    const text = await payload.create({
      collection: 'texts',
      data: { content, application: applicationId },
    })

    // Generate and store embeddings for the text
    await storeEmbeddings(text.id, content)

    console.log('Text successfully created with embeddings.', text)

    return 'Text successfully created with embeddings.'
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error, please try again.'
  }
}
