import { anthropic } from '@ai-sdk/anthropic';
import { computerTool } from '@/tools/computer-use';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

    const result = streamText({
        model: anthropic('claude-3-5-sonnet-20240620'),
        prompt: messages,
        tools: { computerTool },
    });

    return result.toDataStreamResponse();
}
