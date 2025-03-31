import type { CollectionConfig } from 'payload'

export const Applications: CollectionConfig = {
  slug: 'applications',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
  },
  access: {
    read: () => true, // Adjust access control as needed
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'name',
      label: 'Application Name',
      type: 'text',
      required: true,
      index: true, // Index for faster lookups
    },
    {
      name: 'description',
      label: 'Application Description (Context for AI)',
      type: 'textarea', // Textarea for longer descriptions
      required: true,
    },
    {
      name: 'version',
      label: 'Application Version',
      type: 'text',
      required: false,
    },
    // Optional: Add an icon field if desired
    // {
    //   name: 'icon',
    //   label: 'Icon Identifier (e.g., Lucide name)',
    //   type: 'text',
    // },
  ],
}
