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
  },
}
