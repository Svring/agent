import type { CollectionConfig } from 'payload'

export const Projects: CollectionConfig = {
  slug: 'projects',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'dev_address',
      type: 'array',
      fields: [
        {
          name: 'address',
          type: 'text',
        },
        {
          name: 'port',
          type: 'number',
        },
        {
          name: 'username',
          type: 'text',
        },
        {
          name: 'password',
          type: 'text',
        },
      ],
    },
    {
      name: 'production_address',
      type: 'text',
    },
    {
      name: 'sessions',
      type: 'relationship',
      relationTo: 'sessions',
      hasMany: true,
    },
  ]
}
