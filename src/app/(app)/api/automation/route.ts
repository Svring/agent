import { anthropic } from '@ai-sdk/anthropic';
import { computerUseTool } from '@/tools/computer-use';
import { addTextTool } from '@/tools/add-text';
import { getInformationTool } from '@/tools/get-information';
import { askForConfirmationTool } from '@/tools/ask-confirm';
import { appendResponseMessages, appendClientMessage, streamText } from 'ai';
// import { loadChat, saveChat } from '@/db/actions/Messages';
import { loadChat, saveChat } from '@/tools/chat-store';

export async function POST(req: Request) {
  const { id, messages, model } = await req.json();

  // const messages = await loadChat(id);

  // const messages = appendClientMessage({
  //   messages: previousMessages,
  //   message,
  // });

  const systemPrompt = `
You are an AI assistant designed to help users by interacting with a computer graphical user interface (GUI) based on their instructions. Your goal is to automate software testing or other GUI-based tasks.

You have access to the following tools:
- computerUseTool: Allows you to see the screen (take a screenshot) and perform actions like clicking, dragging, typing, and moving the mouse.
- addTextTool: Adds text to a knowledge base.
- getInformationTool: Retrieves information from the knowledge base.
- askForConfirmationTool: Asks the user for confirmation before performing a potentially sensitive action.

**Your primary workflow for interacting with the GUI should be:**
1.  **See:** Start by using the 'computerUseTool' with the 'screenshot' action to understand the current state of the screen.
2.  **Decide:** Analyze the screenshot in the context of the user's request.
    - Determine the single next best GUI action (e.g., click, type, move).
3.  **Act:** Call the 'computerUseTool' with the appropriate action.
4.  **Repeat:** Continue this cycle.

Always take a screenshot before deciding on the next action unless you are certain about the state of the screen from the immediately preceding step. Be precise in your actions.
  `
  const tools = {
    computer: computerUseTool,
    addTextTool,
    getInformationTool,
    // askForConfirmation: askForConfirmationTool
  };

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: systemPrompt,
    messages,
    tools: tools,
    maxSteps: 5,
    toolCallStreaming: true,
    onError({ error }) {
      console.error('here is the streamText error from automation api: ' + error);
    },
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

  result.consumeStream().catch(consumeError => {
    console.error(`[API ROUTE DEBUG] Error consuming stream for chat ID ${id}:`, consumeError);
  });

  return result.toDataStreamResponse();
}
