import { castingManager } from '@/backstage/casting-manager';
// Infer type from the factory function as direct type export might be missing/changed
import { experimental_createMCPClient } from 'ai'; 

type PlaywrightClientType = Awaited<ReturnType<typeof experimental_createMCPClient>>; 
type PropsClientType = Awaited<ReturnType<typeof experimental_createMCPClient>>;

export async function POST(req: Request) {
  const body = await req.json();
  console.log('Request Body:', JSON.stringify(body, null, 2));
  const { messages, model: selectedModelName, tools: selectedToolKeys, customInfo } = body;

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
  console.log('Custom Info:', customInfo);
  // Get model by name
  const defaultModelName = castingManager.getModelOptions()[0]?.key || 'claude-3-5-sonnet-latest'; 
  const model = castingManager.getModelByName(selectedModelName || defaultModelName);
  if (!model) {
    console.log('Error: Invalid or unavailable model selected:', selectedModelName);
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
  If you have the 'Browser Control' tool enabled, you can use it to browse websites, get information, and interact with pages. 

  ${customInfo}
  `;

  // Initialize tools object and playwright client variable
  const tools: Record<string, any> = {};
  let playwrightClient: PlaywrightClientType | null = null; // Use inferred type
  let loadedPlaywrightTools: Record<string, any> = {};
  let propsClient: PropsClientType | null = null;
  let loadedPropsTools: Record<string, any> = {};

  // Check if playwright tool is selected
  const usePlaywright = selectedToolKeys?.includes('playwright');
  const useProps = selectedToolKeys?.includes('props');

  if (usePlaywright) {
    console.log('Playwright tool selected. Loading playwright tools...');
    try {
      const { playwrightTools: dynamicTools, playwrightClient: client } = await castingManager.getPlaywrightTools();
      playwrightClient = client; // Assign the client
      loadedPlaywrightTools = dynamicTools;
      console.log('Playwright tools loaded:', Object.keys(loadedPlaywrightTools));
      Object.assign(tools, loadedPlaywrightTools); // Merge playwright tools
    } catch (error) {
      console.error('Failed to load playwright tools:', error);
      // Decide if you want to return an error or continue without playwright tools
      // For now, let's log and continue without them
    }
  }

  if (useProps) {
    console.log('Props tool selected. Loading props tools...');
    try {
      const { propsTools: dynamicTools, propsClient: client } = await castingManager.getPropsTools();
      propsClient = client; // Assign the client
      loadedPropsTools = dynamicTools;
      console.log('Props tools loaded:', Object.keys(loadedPropsTools));
      Object.assign(tools, loadedPropsTools); // Merge props tools
    } catch (error) {
      console.error('Failed to load props tools:', error);
      // Continue without props tools if loading fails
    }
  }

  // Add selected *static* tools to the tools object
  if (selectedToolKeys && Array.isArray(selectedToolKeys)) {
    console.log('Adding selected static tools...');
    selectedToolKeys.forEach((toolKey: string) => {
      // Skip the playwright and props keys as they're handled above
      if (toolKey === 'playwright' || toolKey === 'props') return;
      
      const tool = castingManager.getToolByKey(toolKey);
      if (tool) {
        tools[toolKey] = tool;
        console.log(`Static tool added: ${toolKey}`);
      } else {
        console.log(`Static tool not found or invalid: ${toolKey}`);
      }
    });
  }

  console.log('Final tools list for casting:', Object.keys(tools));

  let result;
  try {
    console.log('Initiating casting process...');
    result = await castingManager.cast({
      model, 
      tools, // Pass the final combined tools object
      systemPrompt,
      messages,
      maxSteps: 20,
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
        // Conditionally close playwright and props clients
        if (playwrightClient || propsClient) {
          console.log('Casting process finished, closing clients...');
          if (playwrightClient) {
            await playwrightClient.close();
            console.log('Playwright client closed.');
          }
          if (propsClient) {
            await propsClient.close();
            console.log('Props client closed.');
          }
        } else {
          console.log('Casting process finished (no clients to close).');
        }
      },
    });
    console.log('Casting process completed successfully.');
  } catch (err) {
    console.error('[DEBUG] Error in POST handler:', err);
    // Ensure clients are closed even if casting fails mid-stream
    if (playwrightClient || propsClient) {
      console.log('Error occurred, ensuring clients are closed...');
      if (playwrightClient) {
        await playwrightClient.close();
        console.log('Playwright client closed after error.');
      }
      if (propsClient) {
        await propsClient.close();
        console.log('Props client closed after error.');
      }
    }
    throw err;
  }

  return result.toDataStreamResponse();
}