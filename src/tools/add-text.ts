import { tool } from 'ai';
import { z } from 'zod';
import { createText } from '@/db/actions/Texts';

export const addTextTool = tool({
  description: `Stores a piece of textual information (provided as the 'content' string parameter) into the dedicated knowledge base. Use this tool to capture facts, notes, or general knowledge volunteered by the user, especially if provided unprompted and seems potentially useful for future reference. Do not use this for storing direct instructions or user preferences; retrieve preferences using getInformationTool.`,
  parameters: z.object({
    content: z
      .string()
      .describe('the content or resource to add to the knowledge base'),
    applicationId: z.number().describe('the ID of the application to add the text to'),
  }),
  execute: async ({ content, applicationId }) => createText(content, applicationId),
});
