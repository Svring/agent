import { castingManager } from '@/backstage/casting-manager';

// --- Helpers ---
function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildSystemPrompt(customInfo: string) {
  return `
You are a concise agent focused on action. Speak minimally and prioritize using your tools to assist the user effectively. After each tool call, report the result back to the user clearly and briefly.

${customInfo}
`;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, model: selectedModelName, tools: selectedToolKeys, customInfo } = body;

  const model = castingManager.getModelByName(selectedModelName);
  if (!model) {
    return errorResponse(`Invalid or unavailable model selected: ${selectedModelName}`, 400);
  }

  // Prompt
  const systemPrompt = buildSystemPrompt(customInfo);

  // Tool loading
  let tools: Record<string, any> = {};
  try {
    tools = await castingManager.loadSelectedTools(selectedToolKeys);
  } catch (error) {
    console.error('Failed to load selected tools:', error);
    return errorResponse('Failed to load selected tools', 500);
  }

  // Casting
  const result = await castingManager.cast({
    model,
    tools,
    systemPrompt,
    messages,
    maxSteps: 20,
    toolCallStreaming: true,
    onError({ error }: { error: any }) {
      console.error('streamText error from automation api:', JSON.stringify(error, null, 2));
    },
    onFinish: async () => {
      await castingManager.closeClients();
    },
  });

  return result.toDataStreamResponse();
}

function orchestrate(messages: any[]) {
  
}