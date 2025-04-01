import type { CollectionConfig } from 'payload'

export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    // Avoid using a complex field like 'parts' as title
    // defaultColumns: ['role', 'chatSession', 'createdAt'],
    description: 'Stores individual messages within a chat session, including tool interactions.',
    hidden: false, // Make visible in admin UI if needed for debugging
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'chatSession',
      label: 'Chat Session',
      type: 'relationship',
      relationTo: 'chat_sessions',
      hasMany: false,
      required: true,
      index: true, // Index for efficient querying by session
      admin: {
        position: 'sidebar',
      }
    },
    {
      name: 'role',
      label: 'Role',
      type: 'select',
      options: [
        { label: 'User', value: 'user' },
        { label: 'Assistant', value: 'assistant' },
        { label: 'Tool', value: 'tool' },
        // Add other roles if the SDK uses them (e.g., 'system')
      ],
      required: true,
    },
    // Add top-level content field based on example
    {
      name: 'content',
      label: 'Content',
      type: 'textarea', // Stores the final string representation of the message
      admin: {
        description: 'The final textual content of the message.'
      }
    },
    {
      name: 'parts',
      label: 'Message Parts',
      type: 'array',
      minRows: 1,
      interfaceName: 'MessageParts', // Optional: For TypeScript generation
      admin: {
        description: 'Array of message parts, each with type and corresponding data.'
      },
      fields: [
        {
          name: 'type',
          type: 'select',
          options: [
            { label: 'Text', value: 'text' },
            { label: 'Tool Invocation', value: 'tool-invocation' },
            // Add other types as needed
          ],
          required: true,
        },
        {
          name: 'text',
          type: 'textarea',
          admin: {
            condition: (_, siblingData) => siblingData.type === 'text',
          }
        },
        {
          name: 'toolInvocation',
          label: 'Tool Invocation Data',
          type: 'group',
          interfaceName: 'ToolInvocationPart', // Optional: For TypeScript generation
          admin: {
            condition: (_, siblingData) => siblingData.type === 'tool-invocation',
            description: 'Details of a tool invocation within the message parts.',
          },
          fields: [
            {
              name: 'state',
              type: 'select',
              options: [
                { label: 'Result', value: 'result' },
                { label: 'Pending', value: 'pending' },
                { label: 'Error', value: 'error' },
              ],
              defaultValue: 'pending',
            },
            {
              name: 'step',
              type: 'number',
            },
            {
              name: 'toolCallId',
              type: 'text',
              required: true,
              index: true,
            },
            {
              name: 'toolName',
              type: 'text',
              required: true,
              index: true,
            },
            {
              name: 'args',
              type: 'json', // Arguments can be complex objects
              label: 'Arguments',
            },
            {
              name: 'result',
              type: 'json', // Result can be complex (object, array, text)
              label: 'Result',
            },
          ]
        },
      ]
    },
    // Add revisionId based on example
    {
      name: 'revisionId',
      label: 'Revision ID',
      type: 'text',
      index: true,
      admin: {
        readOnly: true, // Typically assigned by the system
        position: 'sidebar',
      }
    }
    // Payload automatically adds id, createdAt, updatedAt
    // createdAt is useful for ordering messages
  ],
} 