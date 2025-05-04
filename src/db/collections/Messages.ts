import { CollectionConfig } from "payload";
import { MessageSchema } from "../../app/(app)/api/opera/counterfeit/schemas";

export const Messages: CollectionConfig = {
  slug: 'messages',
  defaultSort: 'createdAt',
  admin: {},
  fields: [
    {
      name: 'messageId',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'createdAt',
      type: 'date',
    },
    {
      name: 'content',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'System', value: 'system' },
        { label: 'User', value: 'user' },
        { label: 'Assistant', value: 'assistant' },
        { label: 'Data', value: 'data' },
      ],
    },
    {
      name: 'parts',
      type: 'json',
      validate: (value) => {
        try {
          if (value) {
            const result = MessageSchema.shape.parts?.safeParse(value);
            if (!result.success) {
              return result.error.message;
            }
          }
          return true;
        } catch (error) {
          return 'Invalid parts structure';
        }
      },
    },
    {
      name: 'annotations',
      type: 'json',
    },
    {
      name: 'session',
      type: 'relationship',
      relationTo: 'sessions',
      required: true,
    },
    {
      name: 'rawData',
      type: 'json',
      admin: {
        description: 'The complete message data in JSON format',
      },
      validate: (value) => {
        try {
          if (value) {
            const result = MessageSchema.safeParse(value);
            if (!result.success) {
              return result.error.message;
            }
          }
          return true;
        } catch (error) {
          return 'Invalid message structure';
        }
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Set messageId to the id field from MessageSchema if not already set
        if (data.rawData && data.rawData.id && !data.messageId) {
          data.messageId = data.rawData.id;
        }
        return data;
      }
    ]
  }
};
