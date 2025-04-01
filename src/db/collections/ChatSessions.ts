import type { CollectionConfig } from 'payload'
import type { PayloadRequest } from 'payload'

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
      label: 'Session Name (Identifier)',
      type: 'text',
      required: true,
      index: true,
      unique: true,
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
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        if (!id || !req?.payload) {
           console.error('Missing ID or Payload API in beforeDelete hook for chat_sessions.');
           throw new Error('Cannot perform cascade delete due to missing context.');
        }

        console.log(`Attempting to cascade delete messages for ChatSession ID: ${id}`);

        try {
          const deleteMessagesResult = await req.payload.delete({
            collection: 'messages',
            where: {
              chatSession: { equals: id },
            },
          });

          console.log(`Cascade delete result for messages of session ${id}:`, deleteMessagesResult);

        } catch (error) {
          console.error(`Error during cascade delete of messages for ChatSession ${id}:`, error);
          throw new Error(`Failed to delete related messages. Aborting deletion of ChatSession ${id}.`);
        }
      },
    ],
  },
} 