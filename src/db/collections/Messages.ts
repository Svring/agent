import { CollectionConfig } from "payload";
import { MessageSchema, PlanStepSchema } from "../../app/(app)/api/opera/counterfeit/schemas";
import { z } from 'zod';

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
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
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
      name: 'plan',
      type: 'json',
      admin: {
        description: 'The sequence of steps planned and executed for this message, if applicable. Array of PlanStep objects.',
      },
      validate: (value) => {
        if (value === null || value === undefined) { // Optional field
          return true;
        }
        try {
          const arraySchema = z.array(PlanStepSchema);
          const result = arraySchema.safeParse(value);
          if (!result.success) {
            const issues = result.error.issues.map(issue => `Path: ${issue.path.join('.')} - ${issue.message}`).join('; ');
            return `Invalid plan structure: ${issues}`;
          }
          return true;
        } catch (error) {
          return 'Invalid plan structure due to an unexpected error during validation.';
        }
      },
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
      ({ data, req, operation }) => {
        // Set messageId to the id field from MessageSchema if not already set
        if (data.rawData && data.rawData.id && !data.messageId) {
          data.messageId = data.rawData.id;
        }
        // Ensure createdAt is set, especially for new messages
        if (operation === 'create' && !data.createdAt) {
          data.createdAt = new Date().toISOString();
        } else if (data.rawData && data.rawData.createdAt && !data.createdAt) {
          // If rawData has createdAt and data.createdAt is not set (e.g. during an update where it wasn't provided)
          data.createdAt = new Date(data.rawData.createdAt).toISOString();
        }
        return data;
      }
    ]
  }
};
