import { castingManager } from '@/backstage/casting-manager';

export async function POST(req: Request) {
  const body = await req.json();
  console.log('Request Body:', JSON.stringify(body, null, 2));
  const { messages, model: selectedModelName, tools: selectedToolKeys } = body;

  // Check if messages array is empty
  if (!messages || messages.length === 0) {
    console.log('Error: Messages array is empty or not provided');
    return new Response(JSON.stringify({ error: 'Messages cannot be empty' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  console.log('Selected Model Name:', selectedModelName);
  console.log('Selected Tool Keys:', selectedToolKeys);

  // Get model by name
  // Use the first available model name as default if none is provided
  const defaultModelName = castingManager.getModelOptions()[0]?.key || 'claude-3-5-sonnet-latest'; 
  const model = castingManager.getModelByName(selectedModelName || defaultModelName);
  if (!model) {
    console.log('Error: Invalid or unavailable model selected:', selectedModelName);
    // Attempt to use the default model as a fallback
    const fallbackModel = castingManager.getModelByName(defaultModelName);
    if (!fallbackModel) {
      console.error('Fatal Error: Default model is also unavailable!');
      return new Response(JSON.stringify({ error: 'Selected model unavailable, and default model failed.' }), {
        status: 500, 
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    console.warn(`Falling back to default model: ${defaultModelName}`);
    // If we are here, the fallback model is used (variable name stays 'model' for simplicity)
    // Need to reassign model here if we want to continue with the fallback
    // model = fallbackModel; // Re-assigning `model` to the fallback if we want to proceed.
    // However, the current logic structure returns an error. Let's adjust to proceed with fallback.
    // For now, let's return an error as initially designed if the requested model fails.
     return new Response(JSON.stringify({ error: `Invalid or unavailable model selected: ${selectedModelName}` }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  console.log('Model successfully retrieved:', selectedModelName || defaultModelName);

  const systemPrompt = `
  You are a confident agent who loves to tell everyone you encounter all the tools you have in stock and give suggestions on how to use them.
  `;

  // Dynamically load playwright tools
  console.log('Loading playwright tools...');
  const { playwrightTools, playwrightClient } = await castingManager.getPlaywrightTools();
  console.log('Playwright tools loaded:', Object.keys(playwrightTools));

  const tools: Record<string, any> = {
    ...playwrightTools,
  };

  // Add selected tools to the tools object
  if (selectedToolKeys && Array.isArray(selectedToolKeys)) {
    console.log('Adding selected tools...');
    selectedToolKeys.forEach((toolKey: string) => {
      const tool = castingManager.getToolByKey(toolKey);
      if (tool) {
        tools[toolKey] = tool;
        console.log(`Tool added: ${toolKey}`);
      } else {
        console.log(`Tool not found: ${toolKey}`);
      }
    });
  }

  console.log('Final tools list:', Object.keys(tools));

  let result;
  try {
    console.log('Initiating casting process...');
    result = await castingManager.cast({
      model, // Pass the retrieved model object
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
        console.log('Casting process finished, closing playwright client...');
        await playwrightClient.close();
        console.log('Playwright client closed.');
      },
    });
    console.log('Casting process completed successfully.');
  } catch (err) {
    console.error('[DEBUG] Error in POST handler:', err);
    throw err;
  }

  return result.toDataStreamResponse();
}