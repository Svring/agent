import { castingManager } from '@/backstage/casting-manager';
import { saveSessionMessages } from '@/db/actions/sessions-actions';
import { MessageSchema, type Message, type UIPart } from '@/models/chatSchemas';
import { getAuthenticatedUserId } from '@/lib/auth-utils';
import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
  let authenticatedUserId: string | null = null;
  try {
    authenticatedUserId = await getAuthenticatedUserId(req.headers);
    if (!authenticatedUserId) {
      console.error("[Chat API] Authentication failed or no user ID found in session.");
      return errorResponse('Authentication required.', 401);
    }
    console.log(`[Chat API] Authenticated User ID: ${authenticatedUserId}`);

    const body = await req.json();
    const { messages, sessionId, model: selectedModelName, tools: selectedToolKeys, customInfo } = body;

    if (!sessionId) {
      return errorResponse('sessionId is required in the request body', 400);
    }
    // It's good to log that the incoming sessionId from body is for DB association,
    // while authenticatedUserId is for manager operations.
    console.log(`[Chat API] Request for DB sessionId: ${sessionId} by User ID: ${authenticatedUserId}`);

    // getModelByName is public
    const model = castingManager.getModelByName(selectedModelName);
    if (!model) {
      return errorResponse(`Invalid or unavailable model selected: ${selectedModelName}`, 400);
    }

    const systemPrompt = buildSystemPrompt(customInfo);

    // Initialize user session in CastingManager, which also loads tools
    // This replaces the direct call to a global loadSelectedTools
    try {
      await castingManager.initializeUserSession(authenticatedUserId, selectedModelName, selectedToolKeys, systemPrompt);
    } catch (error) {
      console.error(`[Chat API] User ${authenticatedUserId}: Failed to initialize user session or load tools:`, error);
      return errorResponse('Failed to initialize session or load tools', 500);
    }
    
    // The tools for the user are now managed within their session config in CastingManager
    // The cast method will retrieve them internally using the userId.

    const result = await castingManager.cast({
      userId: authenticatedUserId, // Pass authenticatedUserId
      // model, systemPrompt, and tools will be taken from the user's session config by cast method
      // No need to pass model, systemPrompt, tools directly here if initializeUserSession was successful
      messages,
      maxSteps: 20,
      toolCallStreaming: true,
      onError({ error }: { error: any }) {
        console.error(`[Chat API] User ${authenticatedUserId}: streamText error:`, JSON.stringify(error, null, 2));
      },
      onFinish: async ({ response }) => {
        try {
          const finalMessages = mergeAssistantResponse(messages, response, sessionId);
          if (finalMessages.length > messages.length) {
            await saveSessionMessages(sessionId, finalMessages);
          }
        } catch (error) {
          console.error(`[Chat API] User ${authenticatedUserId}: Error during onFinish for session ${sessionId}:`, error);
        }
        // Client closing is now handled per-user within the cast method's onFinish in CastingManager
        // No need to call castingManager.closeClients() here directly.
      },
    });

    return result.toDataStreamResponse();

  } catch (error) {
    const authUserIdForLog = authenticatedUserId || 'unknown';
    console.error(`[Chat API] User [${authUserIdForLog}] POST request failed:`, error);
    return errorResponse('Failed to process chat request', 500);
  }
}
