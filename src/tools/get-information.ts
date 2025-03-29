import { tool } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/db/actions/Embeddings';

export const getInformationTool = tool({
  description: `get information from your knowledge base to answer questions, especially for questions about the user's preferences and today's date.`,
  parameters: z.object({
    question: z.string().describe('the users question'),
  }),
  execute: async ({ question }) => findRelevantContent(question),
});
