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
  console.log(`[DEBUG] mergeAssistantResponse called with sessionId: ${sessionId} (${typeof sessionId})`);

  const updatedOriginalMessages = originalMessages.map(msg => ({
    ...msg,
    session: sessionId
  }));

  const intermediateAssistantMessages: Array<Message & { session?: string }> = []; // Renamed for clarity
  const toolResultsMap = new Map<string, any>(); 

  if (!assistantResponse || !Array.isArray(assistantResponse.messages)) {
    console.warn('Assistant response is missing or has no messages property.');
    return updatedOriginalMessages;
  }

  console.log(`[DEBUG] Processing ${assistantResponse.messages.length} messages from assistant response`);

  // Pass 1: Extract tool results and standard assistant messages/calls
  for (const msgData of assistantResponse.messages) {
    console.log(`[DEBUG] Pass 1: Processing message ID ${msgData.id}, role: ${msgData.role}`);
    if (msgData.role === 'assistant' && Array.isArray(msgData.content)) {
      const incomingParts = msgData.content as any[];
      const messageParts: UIPart[] = [];
      let textContent = '';
      let containsToolCall = false;

      for (const part of incomingParts) {
        if (part.type === 'text') {
          messageParts.push({ type: 'text', text: part.text });
          textContent += (textContent ? '\n' : '') + part.text;
        } else if (part.type === 'tool-call') {
          containsToolCall = true;
          messageParts.push({
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.args || {},
              state: 'call',
            }
          });
        } else {
           console.warn(`[DEBUG] Pass 1: Skipping unexpected part type in assistant message: ${part.type}`);
        }
      }

      if (messageParts.length === 0 && !textContent) {
         console.warn(`[DEBUG] Pass 1: Skipping assistant message ${msgData.id} with no processable parts or text.`);
         continue;
      }
      
      const messageData: Partial<Message> = {
        id: msgData.id || `gen_call_${Date.now()}`,
        role: 'assistant',
        content: textContent || (containsToolCall ? '[Calling Tool...]' : ''),
        parts: messageParts,
        createdAt: new Date(),
        annotations: [],
      };

      const validationResult = MessageSchema.safeParse(messageData);
      if (validationResult.success) {
        intermediateAssistantMessages.push({ ...validationResult.data, session: sessionId });
      } else {
        console.warn('[Pass 1] Failed to validate constructed assistant message:', validationResult.error.flatten());
      }

    } else if (msgData.role === 'tool' && Array.isArray(msgData.content)) {
      for (const part of msgData.content) {
        if (part.type === 'tool-result' && part.toolCallId) {
           console.log(`[DEBUG] Pass 1: Storing result for toolCallId: ${part.toolCallId}`);
           toolResultsMap.set(part.toolCallId, { toolName: part.toolName, result: part.result });
        } else {
            console.warn(`[DEBUG] Pass 1: Skipping unexpected/invalid part type in tool message: ${part.type}`);
        }
      }
    } else {
      console.warn('[Pass 1] Skipping unexpected message structure in assistant response:', msgData);
    }
  }

  // Pass 2: Update messages containing 'call' states with their results
  for (const assistantMsg of intermediateAssistantMessages) {
    if (assistantMsg.parts) {
      let contentUpdated = false;
      assistantMsg.parts = assistantMsg.parts.map(part => {
        if (part.type === 'tool-invocation' && part.toolInvocation.state === 'call') {
          const resultData = toolResultsMap.get(part.toolInvocation.toolCallId);
          if (resultData) {
            console.log(`[DEBUG] Pass 2: Found result for toolCallId: ${part.toolInvocation.toolCallId}. Updating part state.`);
            part.toolInvocation.state = 'result';
            part.toolInvocation.result = resultData.result;
            if (typeof resultData.result === 'string') {
               assistantMsg.content = resultData.result;
            } else if (resultData.result && typeof resultData.result === 'object') {
               assistantMsg.content = `[Result for ${resultData.toolName}]`;
            }
            contentUpdated = true;
            return part;
          }
        }
        return part;
      });
       if (!contentUpdated && assistantMsg.parts.some(p => p.type === 'tool-invocation') && !assistantMsg.content) {
           assistantMsg.content = '[Tool Interaction]';
       }
    }
  }

  // Pass 3: Merge consecutive assistant messages
  const finalAssistantMessages: Array<Message & { session?: string }> = [];
  if (intermediateAssistantMessages.length > 0) {
    // Start with the first message
    let currentMergedMessage = { ...intermediateAssistantMessages[0] }; 
    // Ensure parts is always an array, even if initially undefined/null
    currentMergedMessage.parts = [...(currentMergedMessage.parts || [])]; 

    for (let i = 1; i < intermediateAssistantMessages.length; i++) {
      const nextMessage = intermediateAssistantMessages[i];
      // Check if the next message is also an assistant message
      if (nextMessage.role === 'assistant') {
        console.log(`[DEBUG] Pass 3: Merging message ${nextMessage.id} into ${currentMergedMessage.id}`);
        // Add step-start part
        currentMergedMessage.parts.push({ type: 'step-start' });
        // Append parts from the next message (ensure nextMessage.parts is an array)
        currentMergedMessage.parts.push(...(nextMessage.parts || []));
        // Combine content (optional, adjust as needed)
        currentMergedMessage.content += '\n' + (nextMessage.content || ''); 
      } else {
        // If the next message is not an assistant message, push the current merged one and start anew
        finalAssistantMessages.push(currentMergedMessage);
        currentMergedMessage = { ...nextMessage };
        currentMergedMessage.parts = [...(currentMergedMessage.parts || [])];
      }
    }
    // Push the last merged message
    finalAssistantMessages.push(currentMergedMessage);
  }

  console.log(`[DEBUG] Returning ${updatedOriginalMessages.length} original messages and ${finalAssistantMessages.length} final merged assistant messages`);
  return [...updatedOriginalMessages, ...finalAssistantMessages]; // Use finalAssistantMessages
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
