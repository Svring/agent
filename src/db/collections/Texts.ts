import type { CollectionConfig } from 'payload'

export const Texts: CollectionConfig = {
  slug: 'texts',
  admin: {
    useAsTitle: 'content',
    description: 'Stores chunks of text content, often used for knowledge base.'
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'content',
      type: 'textarea',
      required: true,
      label: 'Text Content',
    },
    {
      name: 'application',
      label: 'Related Application',
      type: 'relationship',
      relationTo: 'applications',
      hasMany: false,
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc }) => {
        console.log('afterChange of texts', doc)
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        if (!id || !req?.payload) {
           console.error('Missing ID or Payload API in beforeDelete hook for texts.');
           throw new Error('Cannot perform cascade delete due to missing context.');
        }

        console.log(`Attempting to cascade delete embeddings for Text ID: ${id}`);

        try {
          const deleteEmbeddingsResult = await req.payload.delete({
            collection: 'embeddings',
            where: {
              sourceText: { equals: id },
            },
          });

          console.log(`Cascade delete result for embeddings of text ${id}:`, deleteEmbeddingsResult);

        } catch (error) {
          console.error(`Error during cascade delete of embeddings for Text ${id}:`, error);
          throw new Error(`Failed to delete related embeddings. Aborting deletion of Text ${id}.`);
        }
      },
    ],
  },
}
