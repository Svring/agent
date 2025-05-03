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
    
  ],
  access: {
    read: () => true,
    create: ({ req: { user }, data }) => {
      if (user?.email === 'dummy@cute.com') {
        return true;
      }
      return false;
    },
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
}
