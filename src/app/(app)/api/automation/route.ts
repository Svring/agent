import { anthropic } from '@ai-sdk/anthropic';
import { computerUseTool } from '@/tools/computer-use';
import { addTextTool } from '@/tools/add-text';
import { getInformationTool } from '@/tools/get-information';
import { appendResponseMessages, appendClientMessage, streamText } from 'ai';
import { loadChat, saveChat } from '@/tools/chat-store';

export async function POST(req: Request) {
  const { id, message, model } = await req.json();

  const previousMessages = await loadChat(id);

  const messages = appendClientMessage({
    messages: previousMessages,
    message,
  });

  const systemPrompt = `
You are an AI assistant designed to help users by interacting with a computer graphical user interface (GUI) based on their instructions. Your goal is to automate software testing or other GUI-based tasks.

You have access to the following tools:
- computerUseTool: Allows you to see the screen (take a screenshot) and perform actions like clicking and typing.
- addTextTool: Adds text to a knowledge base.
- getInformationTool: Retrieves information from the knowledge base.

**Your primary workflow for interacting with the GUI should be:**
1.  **See:** Start by using the 'computerUseTool' with the 'screenshot' action to understand the current state of the screen.
2.  **Decide:** Analyze the screenshot in the context of the user's request and determine the single next best action (e.g., click a button, type in a field). Identify the precise coordinates for clicks or the text to be typed.
3.  **Act:** Call the 'computerUseTool' again with the appropriate action ('click', 'type', etc.), coordinates, and/or text.
4.  **Repeat:** Continue this cycle of See -> Decide -> Act until the user's task is complete or you encounter an error you cannot resolve.

Always take a screenshot before deciding on the next action unless you are certain about the state of the screen from the immediately preceding step. Be precise in your actions. If you need information from the knowledge base to proceed (e.g., user preferences), use 'getInformationTool'. If the user provides general knowledge, use 'addTextTool'.
  `

  const result = streamText({
    model: anthropic('claude-3-5-haiku-20241022'),
    system: systemPrompt,
    messages,
    tools: {
      computer: computerUseTool,
      addTextTool,
      getInformationTool
    },
    maxSteps: 3,
    async onFinish({ response }) {
      await saveChat({
        id,
        messages: appendResponseMessages({
          messages,
          responseMessages: response.messages,
        }),
      });
    },
  });

  // consume the stream to ensure it runs to completion & triggers onFinish
  // even when the client response is aborted:
  result.consumeStream(); // no await

  return result.toDataStreamResponse();
}
