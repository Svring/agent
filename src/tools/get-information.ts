import { tool } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/db/actions/Embeddings';

export const getInformationTool = tool({
  description: `Retrieves relevant information specifically from the custom knowledge base based on the user's query (provided as the 'question' string parameter). Use this tool *instead of* relying on general knowledge when asked about the user's personal preferences, details remembered from previous interactions, automation software tests, specific project context, or any topic likely stored previously in the knowledge base (e.g., via addTextTool). Essential for recalling user-specific or project-specific details accurately.`,
  parameters: z.object({
    question: z.string().describe('the users question'),
  }),
  execute: async ({ question }) => findRelevantContent(question),
});
