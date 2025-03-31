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
    {
      name: 'parts',
      label: 'Message Parts',
      type: 'array',
      minRows: 1,
      fields: [
        // Define sub-fields based on Vercel AI SDK message part structure
        {
          name: 'type',
          type: 'select',
          options: [
            { label: 'Text', value: 'text' },
            { label: 'Tool Invocation', value: 'tool-invocation' },
            // Add 'tool-result' if you store results separately in parts
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
          type: 'json', // Store complex object from SDK
          label: 'Tool Invocation Data',
          admin: {
            description: 'Contains tool name, args, state, result, etc.',
            condition: (_, siblingData) => siblingData.type === 'tool-invocation',
          }
        },
         // Optional: Add specific field for tool-result if not storing in toolInvocation JSON
        // {
        //   name: 'toolResult',
        //   type: 'json', 
        //   label: 'Tool Result Data',
        //   admin: {
        //      condition: (_, siblingData) => siblingData.type === 'tool-result',
        //   }
        // },
      ]
    },
     {
      name: 'toolCallId',
      label: 'Tool Call ID (for Tool role)',
      type: 'text',
      index: true,
      admin: {
          condition: (_, siblingData) => siblingData.role === 'tool',
          description: 'Links a tool result message back to its invocation.'
      }
    },
    {
      name: 'toolName',
      label: 'Tool Name (for Tool role)',
      type: 'text',
      index: true,
       admin: {
          condition: (_, siblingData) => siblingData.role === 'tool',
      }
    },
    // Payload automatically adds id, createdAt, updatedAt
    // createdAt is useful for ordering messages
  ],
} 