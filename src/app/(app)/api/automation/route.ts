import { anthropic } from '@ai-sdk/anthropic';
import { computerUseTool } from '@/tools/computer-use';
import { addTextTool } from '@/tools/add-text';
import { getInformationTool } from '@/tools/get-information';
import { workflowUseTool } from '@/tools/workflow-use/workflow-use';
import { askForConfirmationTool } from '@/tools/ask-confirm';
import { appendResponseMessages, appendClientMessage, streamText, generateObject } from 'ai';
// import { loadChat, saveChat } from '@/db/actions/Messages';
import { loadChat, saveChat } from '@/tools/chat-store';
import { z } from 'zod';

export async function POST(req: Request) {
  const { id, messages, model, appId } = await req.json();

  console.log('appId on the route: ' + appId)

  // const messages = await loadChat(id);

  // const messages = appendClientMessage({
  //   messages: previousMessages,
  //   message,
  // });

  const systemPrompt = `
You are an AI assistant designed to help users by interacting with a computer graphical user interface (GUI) based on their instructions. Your goal is to automate software testing or other GUI-based tasks.

You have access to the following tools:
- computerUseTool: Allows you to see the screen (take a screenshot) and perform actions like clicking, dragging, typing, and moving the mouse.
- workflowUseTool: Manages automation workflows - create, read, update, and delete workflows and their steps for repeatable automation sequences.
- addTextTool: Adds text to a knowledge base for later retrieval.
- getInformationTool: Retrieves information from the knowledge base based on user queries.

**Your primary workflows:**

For GUI interaction:
1. **See:** Start by using the 'computer' tool with the 'screenshot' action to understand the current state of the screen.
2. **Decide:** Analyze the screenshot in the context of the user's request.
3. **Act:** Call the 'computer' tool with the appropriate action (click, type, move).
4. **Repeat:** Continue this cycle as needed.

For workflow management:
1. **Create workflows:** Use the 'workflow' tool with 'create' action to save sequences of steps for future use.
2. **Execute workflows:** Retrieve workflows with 'get' action and execute their steps.
3. **Modify workflows:** Update existing workflows with new steps or changes.

Always take a screenshot before deciding on the next GUI action unless you are certain about the state of the screen from the immediately preceding step. Be precise in your actions.

The cuurent application's id is ${appId}, invoke the tools with this information in mind.
  `
  const tools = {
    computer: computerUseTool,
    workflow: workflowUseTool,
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

async function routeDirective(messages: any) {
  const systemPrompt = `
  
  `

  const { object: routeMessage } = await generateObject({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: systemPrompt,
    prompt: messages,
    schema: z.object({
      routeType: z.enum(['chat', 'workflowAction']).describe(''),
      missionDescription: z.string().describe('')
    })
  })

  return routeMessage;
}

async function workflowDirective(messages: any) {
  const systemPrompt = `
  
  `

  const { object: routeMessage } = await generateObject({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: systemPrompt,
    prompt: messages,
    schema: z.object({
      routeType: z.enum(['chat', 'workflowAction']).describe(''),
      missionDescription: z.string().describe('')
    })
  })

  return routeMessage;
}
