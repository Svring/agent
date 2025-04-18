import { createOpenAI } from '@ai-sdk/openai';
import { experimental_createMCPClient, streamText } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const sealos = createOpenAI({
    // custom settings, e.g.
    name: 'sealos',
    baseURL: process.env.SEALOS_BASE_URL,
    apiKey: process.env.SEALOS_API_KEY,
  });

  const model = sealos('qwen-vl-plus-latest');

  const systemPrompt = `
  You are a helpful assistant that can answer questions and help with tasks.
  If the user asks you to browse, visit, interact with a web page, or take a screenshot of a website, you MUST use the playwright tool to perform these actions.
  Use the playwright tool for any web automation, navigation, or screenshot requests.
  `;

  const playwrightTransport = new Experimental_StdioMCPTransport({
    command: 'node',
    args: ['src/tools/mcp/playwright.mjs'],
  });
  const playwrightClient = await experimental_createMCPClient({
    transport: playwrightTransport,
  });
  const playwrightTools = await playwrightClient.tools();

  const tools = {
    ...playwrightTools,
  };

  let result;
  try {
    result = await streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5,
      toolCallStreaming: true,
      onError({ error }) {
        console.error('here is the streamText error from automation api:', JSON.stringify(error, null, 2));

        // Handle error object regardless of its type
        const errorObj = error as Error | Record<string, any>;
        console.error('Error details:', {
          name: typeof errorObj === 'object' && errorObj !== null ? errorObj.name : 'Unknown error',
          message: typeof errorObj === 'object' && errorObj !== null ? errorObj.message : String(errorObj),
          stack: typeof errorObj === 'object' && errorObj !== null ? errorObj.stack : undefined,
          cause: typeof errorObj === 'object' && errorObj !== null ? errorObj.cause : undefined
        });
      },
      onFinish: async () => {
        await playwrightClient.close();
      },
    });
  } catch (err) {
    console.error('[DEBUG] Error in POST handler:', err);
    throw err;
  }

  return result.toDataStreamResponse();
}