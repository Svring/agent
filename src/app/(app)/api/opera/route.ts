import { castingManager } from '@/backstage/casting-manager';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const model = castingManager.getModelFactories().sealosQwen();

  const systemPrompt = `
  You are a helpful assistant that can answer questions and help with tasks.
  If the user asks you to browse, visit, interact with a web page, or take a screenshot of a website, you MUST use the playwright tool to perform these actions.
  Use the playwright tool for any web automation, navigation, or screenshot requests.
  `;

  // Dynamically load playwright tools
  const { playwrightTools, playwrightClient } = await castingManager.getPlaywrightTools();

  const tools = {
    ...playwrightTools,
  };

  let result;
  try {
    result = await castingManager.cast({
      model,
      tools,
      systemPrompt,
      messages,
      maxSteps: 5,
      toolCallStreaming: true,
      onError({ error }: { error: any }) {
        console.error('here is the streamText error from automation api:', JSON.stringify(error, null, 2));
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