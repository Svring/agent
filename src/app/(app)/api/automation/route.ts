import { anthropic } from '@ai-sdk/anthropic';
import { computerUseTool } from '@/tools/computer-use';
import { addTextTool } from '@/tools/add-text';
import { getInformationTool } from '@/tools/get-information';
import { workflowUseTool } from '@/tools/workflow-use/workflow-use';
import { bashTool } from '@/tools/bash';
import { textEditorTool } from '@/tools/text-editor';
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
You are an AI assistant designed to help users by interacting with a computer graphical user interface (GUI) based on their instructions. Your goal is to automate software testing or other GUI-based tasks for the current application (ID: ${appId}).

You have access to the following tools:
- **computerUseTool**: Allows you to see the screen (take a screenshot) and perform actions like clicking, dragging, typing, and moving the mouse.
- **workflowUseTool**: Manages automation workflows—create, read, update, and delete workflows and their steps for repeatable automation sequences.
- **bashTool**: Executes shell commands on the system, allowing you to interact with the operating system directly. Use this for file operations, checking system status, or running CLI commands that aren't accessible through the GUI.
- **textEditorTool**: Provides abilities to view, create, edit, and modify files on the system. Supports operations like viewing file contents, creating new files, replacing text, inserting at specific line numbers, and undoing changes.
- **addTextTool**: Stores text in a knowledge base to index context about complex apps. Use this to record unobvious insights about the current app (e.g., unique button functionalities, hidden features, or the app's operational purpose) when instructed by the user or when you discover such knowledge independently.
- **getInformationTool**: Retrieves information from the knowledge base. Use this when additional context is needed to complete a task and the app's interface alone isn't sufficient.

**Your primary workflows:**

For GUI interaction:
1. **See**: Start by using the 'computer' tool with the 'screenshot' action to assess the current screen state.
2. **Decide**: Analyze the screenshot in the context of the user's request.
3. **Act**: Call the 'computer' tool with the appropriate action (click, type, move, etc.).
4. **Repeat**: Continue this cycle as needed, taking a screenshot before each action unless the screen state is clear from the prior step.

For shell and file operations:
1. **Command execution**: Use the 'bash' tool to run shell commands when direct system interaction is required.
2. **File manipulation**: Use the 'str_replace_editor' tool to view or edit file contents, create new files, or modify existing ones with operations like inserting text or replacing strings.

For workflow management:
1. **Create workflows**: Use the 'workflow' tool with 'create' action to save step sequences for reuse.
2. **Execute workflows**: Retrieve workflows with 'get' action and execute their steps, you should always retrieve the knowledge base before executing a workflow.
3. **Modify workflows**: Update workflows with new steps or adjustments as needed.

For knowledge management:
- **Store context**: When you or the user identify non-obvious details about the app (e.g., a button's multiple uses or the app's broader purpose), use 'addTextTool' to log this in the knowledge base.
- **Retrieve context**: If a task requires more information than the GUI provides, use 'getInformationTool' to fetch relevant insights from the knowledge base.

Always be precise in your actions and invoke tools with the current application ID (${appId}) in mind. Take screenshots before acting unless the screen state is certain from the previous step.
  `
  const tools = {
    computer: computerUseTool,
    workflow: workflowUseTool,
    bash: bashTool,
    str_replace_editor: textEditorTool,
    addTextTool,
    getInformationTool,
    // askForConfirmation: askForConfirmationTool
  };

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: systemPrompt,
    messages,
    tools: tools,
    maxSteps: 20,
    toolCallStreaming: true,
    onError({ error }) {
      console.error('here is the streamText error from automation api:', JSON.stringify(error, null, 2));
      
      // Handle error object regardless of its type
      const errorObj = error as Error | Record<string, any>;
      console.error('Error details:', {
        name: typeof errorObj === 'object' && errorObj !== null ? errorObj.name : 'Unknown error',
        message: typeof errorObj === 'object' && errorObj !== null ? errorObj.message : String(errorObj),
        stack: typeof errorObj === 'object' && errorObj !== null ? errorObj.stack : undefined,
        cause: typeof errorObj === 'object' && errorObj !== null ? errorObj.cause : undefined
      });
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
