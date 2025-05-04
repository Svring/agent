import { castingManager } from '@/backstage/casting-manager';
import { saveSessionMessages } from '@/db/actions/sessions-actions';
import { MessageSchema, type Message, type UIPart } from '@/app/(app)/api/opera/counterfeit/schemas';

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

/**
 * Merges the assistant's response messages into the original message list.
 * @param originalMessages - The array of messages from the initial request.
 * @param assistantResponse - The raw response object from the onFinish callback.
 * @param sessionId - The ID of the current session.
 * @returns A new array containing original messages and newly formatted assistant messages.
 */
function mergeAssistantResponse(originalMessages: Message[], assistantResponse: any, sessionId: string): Array<Message & { session?: string }> {
  // Debug: Log the session ID we're working with
  console.log(`[DEBUG] mergeAssistantResponse called with sessionId: ${sessionId} (${typeof sessionId})`);

  // First, ensure all original messages have the session
  const updatedOriginalMessages = originalMessages.map(msg => {
    console.log(`[DEBUG] Adding session to original message ID: ${msg.id}`);
    return {
      ...msg,
      session: sessionId // Add session ID to each original message
    };
  });

  const newMessages: Array<Message & { session?: string }> = [];

  // Check if the response and its messages property are valid
  if (!assistantResponse || !Array.isArray(assistantResponse.messages) || assistantResponse.messages.length === 0) {
    console.warn('Assistant response is missing or has no messages property.');
    return updatedOriginalMessages; // Return only original messages with session ID
  }

  console.log(`[DEBUG] Processing ${assistantResponse.messages.length} messages from assistant response`);

  // Iterate through the messages array within the response
  for (const assistantMsgData of assistantResponse.messages) {
    console.log(`[DEBUG] Assistant message data role: ${assistantMsgData.role}, has content array: ${Array.isArray(assistantMsgData.content)}`);
    
    if (assistantMsgData.role === 'assistant' && Array.isArray(assistantMsgData.content)) {
      const parts = assistantMsgData.content as UIPart[];
      
      // Generate fallback text content from text parts
      const textContent = parts
        .filter(part => part.type === 'text' && part.text)
        .map(part => (part as { type: 'text'; text: string }).text)
        .join('\n');

      const messageData: Partial<Message> = {
        id: assistantMsgData.id || `gen_${Date.now()}`, // Use ID from response or generate one
        role: 'assistant',
        content: textContent, // Fallback text content
        parts: parts,         // Structured parts from response content
        createdAt: new Date(), // Add a timestamp
        annotations: [],       // Initialize annotations
      };

      console.log(`[DEBUG] Created message data with ID: ${messageData.id}`);

      // Validate the constructed message
      const validationResult = MessageSchema.safeParse(messageData);
      if (validationResult.success) {
        // Add session after validation since it's not part of MessageSchema
        const validatedMessage = validationResult.data;
        console.log(`[DEBUG] Adding session (${sessionId}) to validated message ID: ${validatedMessage.id}`);
        newMessages.push({
          ...validatedMessage,
          session: sessionId // Add session ID separately
        });
      } else {
        console.warn('Failed to validate constructed assistant message:', validationResult.error.flatten());
        // Optionally push a placeholder or log error message to chat?
      }
    } else {
       console.warn('Skipping unexpected message structure in assistant response:', assistantMsgData);
    }
  }

  console.log(`[DEBUG] Returning ${updatedOriginalMessages.length} original messages and ${newMessages.length} new messages`);
  return [...updatedOriginalMessages, ...newMessages];
}

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, sessionId, model: selectedModelName, tools: selectedToolKeys, customInfo } = body;

  // --- Validation ---
  if (!sessionId) {
    return errorResponse('sessionId is required in the request body', 400);
  }

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
    onFinish: async ({ response }) => {
      try {
        // Log the inputs
        console.log('--- Original Messages for onFinish ---');
        console.log(JSON.stringify(messages, null, 2));
        console.log('--- Raw Assistant Response obj for onFinish ---'); // Log raw response obj
        console.log(JSON.stringify(response, null, 2)); 
        console.log('-------------------------------------------');

        // Use the custom merge function
        const finalMessages = mergeAssistantResponse(messages, response, sessionId);

        // Log the final messages before saving
        console.log('--- Final Messages in onFinish (merged) ---');
        console.log(JSON.stringify(finalMessages, null, 2));
        console.log('-----------------------------------------');

        if (finalMessages.length > messages.length) { // Only save if new messages were added
          console.log(`Saving ${finalMessages.length} messages for session ${sessionId}`);
          const saveSuccess = await saveSessionMessages(sessionId, finalMessages);
          if (!saveSuccess) {
            console.error(`Failed to save messages for session ${sessionId}`);
            // Decide how to handle save failure, e.g., log, retry, notify?
          }
        } else {
          console.log(`No new messages to save for session ${sessionId}`);
        }
      } catch (error) {
        console.error(`Error during onFinish processing for session ${sessionId}:`, error);
      }
      // Close clients regardless of save success/failure
      await castingManager.closeClients();
    },
  });

  return result.toDataStreamResponse();
}
