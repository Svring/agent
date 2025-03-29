import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { addTextTool } from '@/tools/add-text';
import { getInformationTool } from '@/tools/get-information';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini-2024-07-18'),
    system: `You are a helpful assistant. Check your knowledge base before answering any questions.
    Only respond to questions using information from tool calls.
    if no relevant information is found in the tool calls, respond, "Sorry, I don't know."`,
    messages,
    tools: {
      addTextTool,
      getInformationTool,
    },
  });

  return result.toDataStreamResponse();
}
