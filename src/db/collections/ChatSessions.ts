import type { CollectionConfig } from 'payload'

export const ChatSessions: CollectionConfig = {
  slug: 'chat_sessions',
  admin: {
    useAsTitle: 'name', // Use name if available, otherwise fallback to ID
    defaultColumns: ['name', 'application', 'updatedAt'],
    description: 'Represents a single chat conversation or automation session.',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'name',
      label: 'Session Name (Optional)',
      type: 'text',
      required: false, // E.g., could be auto-generated or user-defined
    },
    {
      name: 'application',
      label: 'Target Application',
      type: 'relationship',
      relationTo: 'applications',
      hasMany: false,
      required: true,
      admin: {
        position: 'sidebar',
      }
    },
    // Payload automatically adds id, createdAt, updatedAt
  ],
} 