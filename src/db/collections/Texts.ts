import type { CollectionConfig } from 'payload'

export const Texts: CollectionConfig = {
  slug: 'texts',
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
    }
  ],
  hooks: {
    afterChange: [
      async ({ doc }) => {
        console.log('afterChange of texts', doc)
      },
    ],
  },
}
