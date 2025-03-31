import type { CollectionConfig } from 'payload'

export const Embeddings: CollectionConfig = {
  slug: 'embeddings',
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'content',
      type: 'text',
      required: true,
      label: 'Text Content',
    },
    {
      name: 'embedding',
      type: 'json',
      required: true,
      label: 'Vector Embedding',
    },
    {
      name: 'sourceText',
      type: 'relationship',
      relationTo: 'texts',
      hasMany: false,
      required: true,
      label: 'Source Text',
    }
  ],
  hooks: {
    afterChange: [
      async ({ doc }) => {
        console.log('afterChange of embeddings', doc)
      },
    ],
  },
}
