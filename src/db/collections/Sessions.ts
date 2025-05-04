import { CollectionConfig } from "payload";

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'messages',
      type: 'relationship',
      relationTo: 'messages',
      hasMany: true,
    },
  ],
}
