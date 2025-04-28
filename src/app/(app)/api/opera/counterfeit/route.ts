import { castingManager, getPlaywrightTools, getPropsTools } from '@/backstage/casting-manager';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, streamText, createDataStreamResponse, LanguageModel } from 'ai';
import {
  StepInstructionSchema,
  StepInstruction,
  ReasonResult,
  BrowserResult,
  TerminalResult,
  AnswerResult,
  ErrorResult,
  PlanStep
} from './schemas';

// --- Worker System Prompts ---
const BROWSER_AGENT_PROMPT = (customInfo?: string) => `You are an expert browser agent. You will receive a high-level task from an orchestrator.
Your goal is to fully accomplish the task using the available browser interaction tools. You operate in a browser controlled via Playwright.
You may need to use multiple tools in sequence. Plan your actions and execute the necessary steps.
Report a summary of your actions, the specific tool calls you made, and their results.

Available Tools (Interact with the browser page):
- **playwright_goto**: Navigate the browser to a specific URL.
- **playwright_screenshot**: Take a screenshot of the current page (full page or viewport).
- **playwright_mouse_action**: Perform mouse clicks (left, right, double) at specific viewport coordinates (x, y).
- **playwright_press_key**: Simulate pressing a specific keyboard key (e.g., 'Enter', 'Tab').
- **playwright_type_text**: Type text into the currently focused element.
- **playwright_scroll**: Scroll the page vertically or horizontally by specified pixel amounts.
- **playwright_mouse_move**: Move the mouse cursor to specific viewport coordinates (x, y).
- **playwright_mouse_down** / **playwright_mouse_up**: Simulate pressing/releasing a mouse button at coordinates.
- **playwright_drag**: Simulate dragging the mouse from a start to an end coordinate.

Most tools can optionally return a screenshot after the action.
Use these tools strategically to fulfill the orchestrator's task (e.g., navigate, find information, interact with elements).
If the browser is not initialized or fails, report the error clearly.

${customInfo}`;

const TERMINAL_AGENT_PROMPT = (customInfo?: string) => `You are an expert terminal agent. You will receive a task from an orchestrator.
Your goal is to fully accomplish the task using the available terminal tools (commands).
You may need to execute multiple commands or use tools multiple times in sequence. Plan your actions and execute the necessary steps.
Report a summary of your actions, the specific tool calls you made (commands executed), and their results.

Available Tools:
- **props_execute_command**: Execute a general shell command on the remote server. *Do not use this for launching the dev server.*
- **props_edit_file**: Create or overwrite a file on the remote server with the provided content.
- **props_read_file**: Read the content of a specified file from the remote server.
- **props_launch_dev**: **Use this specific tool** to start the 'npm run dev' development server in the background. It handles prerequisites like killing existing processes on port 3000.
- **props_check_dev_status**: Check if the 'npm run dev' process is currently running.
- **props_get_status**: Check the status of the SSH connection itself (use if connection seems broken).

${customInfo}`;

// --- Orchestrator System Prompt ---
const ORCHESTRATOR_PROMPT = (customInfo?: string) => `You are an orchestrator agent. Your goal is to break down the user's request into sequential steps to achieve the objective.
Based on the conversation history (including previous steps, results, and errors), decide the *next single step's high-level goal*.

You have access to specialized agents:
- **Browser Agent**: Can control a web browser. It can navigate to URLs, take screenshots, click buttons/links (identified by coordinates), type text, scroll, and perform other interactions on a web page. Delegate web-related tasks to this agent using the 'browser' step type. Describe the desired outcome or action clearly (e.g., "Find the main headline on the BBC News homepage", "Log into the user's account on example.com").
- **Terminal Agent**: Can execute commands on the user's file system. Delegate file system operations or command-line tasks to this agent using the 'terminal' step type. Describe the task clearly (e.g., "List the files in the project's source directory").

Choose one of the following step types for the *next single action's goal*:
1.  **reason**: Provide reasoning, interpretation, or an intermediate plan update based on the current state. The instruction content *is* the reasoning itself. Use this for internal thought processes or summarizing progress.
2.  **browser**: Delegate a task requiring web interaction to the browser agent. Formulate a clear, high-level task description for it (e.g., "Search for recent AI news on Google and summarize the top 3 results"). Do *not* specify exact clicks or commands.
3.  **terminal**: Delegate a task requiring command-line execution to the terminal agent. Formulate a clear, high-level task description for it (e.g., "Create a new directory named 'docs' in the root folder"). Do *not* specify the exact commands (like 'mkdir').
4.  **answer**: Provide the final answer if the request is fully addressed or the goal is achieved. The instruction content *is* the final answer.

Provide only the chosen step type and the corresponding high-level instruction/task description for that single step. The specialized agent will determine the specific actions needed.

${customInfo}`;

// --- Helpers ---
function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { messages: initialMessages, model: selectedModelName, customInfo } = body;

  const workerModel = castingManager.getModelByName(selectedModelName);
  if (!workerModel) {
    return errorResponse(`Invalid or unavailable model selected: ${selectedModelName}`, 400);
  }

  try {
    const maxOrchestrationSteps = 20;
    // Use createDataStreamResponse to stream each step
    return createDataStreamResponse({
      async execute(dataStream) {
        const plan: PlanStep[] = [];
        const currentMessages = [...initialMessages];

        // Create the orchestrator model once
        const orchestratorModel = createOpenAI({
          baseURL: process.env.SEALOS_USW_BASE_URL,
          apiKey: process.env.SEALOS_USW_API_KEY,
        })('o3');

        for (let i = 0; i < maxOrchestrationSteps; i++) {
          // 1) Decide the next step via orchestrator
          let stepInstruction: StepInstruction;
          try {
            stepInstruction = await decideNextStep(orchestratorModel, currentMessages, customInfo);
          } catch (decideErr) {
            const errorMessage = decideErr instanceof Error ? decideErr.message : String(decideErr);
            plan.push({
              step: i + 1,
              instruction: { type: 'reason', instruction: 'Error: Orchestrator failed to generate instruction.' },
              result: { error: errorMessage },
            });
            currentMessages.push({ role: 'assistant', content: `[Orchestrator Error] Failed to decide next step: ${errorMessage}` });
            // Stream the current plan and messages
            dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });
            break;
          }

          // 2) Record the step skeleton in the plan (result added later)
          const planStep: PlanStep = {
            step: i + 1,
            instruction: stepInstruction,
          };
          plan.push(planStep);

          currentMessages.push({
            role: 'assistant',
            content: `[Orchestrator] Planning step ${i+1}: ${stepInstruction.type}. Instruction: ${stepInstruction.instruction}`,
          });

          // 3) Execute step based on type
          try {
            switch (stepInstruction.type) {
              case 'reason':
                const reasonResult: ReasonResult = { content: stepInstruction.instruction };
                planStep.result = reasonResult;
                currentMessages.push({ role: 'assistant', content: `[Reasoning] ${reasonResult.content}` });
                break;
              case 'answer':
                const answerResult: AnswerResult = { content: stepInstruction.instruction };
                planStep.result = answerResult;
                currentMessages.push({ role: 'assistant', content: answerResult.content });
                // Stream the final plan and messages
                dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });
                i = maxOrchestrationSteps; // End the loop
                continue;
              case 'browser':
              case 'terminal':
                const workerResult = await executeWorkerStep(stepInstruction, workerModel);
                planStep.result = workerResult;
                if ('error' in workerResult) {
                  currentMessages.push({ role: 'assistant', content: `[Worker Error - ${stepInstruction.type}] ${workerResult.error}` });
                  // Stream the current plan and messages
                  dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });
                  i = maxOrchestrationSteps; // End the loop on worker error
                  continue;
                } else {
                  currentMessages.push({ role: 'assistant', content: `[${stepInstruction.type} Result] ${workerResult.content}` });
                  if (workerResult.toolCalls && workerResult.toolCalls.length > 0) {
                    currentMessages.push({ role: 'assistant', content: `[${stepInstruction.type} Tool Calls] ${JSON.stringify(workerResult.toolCalls)}` });
                  }
                  if (workerResult.toolResults && workerResult.toolResults.length > 0) {
                    currentMessages.push({ role: 'assistant', content: `[${stepInstruction.type} Tool Results] ${JSON.stringify(workerResult.toolResults)}` });
                  }
                }
                break;
              default:
                throw new Error(`Unknown step type: ${(stepInstruction as any).type}`);
            }
          } catch (executionErr) {
            const errorMessage = executionErr instanceof Error ? executionErr.message : String(executionErr);
            planStep.result = { error: errorMessage };
            currentMessages.push({ role: 'assistant', content: `[Execution Error - ${stepInstruction.type}] ${errorMessage}` });
            // Stream the current plan and messages
            dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });
            break;
          }

          // 4) Stream the current plan and messages after each step
          dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });

          // 5) Safeguard against infinite loops
          if (i === maxOrchestrationSteps - 1 && !(planStep.result && 'error' in planStep.result)) {
            const maxStepsError: ErrorResult = { error: 'Reached maximum orchestration steps.'};
            plan.push({
              step: i + 2,
              instruction: { type: 'reason', instruction: 'Max steps reached.' },
              result: maxStepsError,
            });
            currentMessages.push({ role: 'assistant', content: maxStepsError.error });
            dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 2 });
          }
        }
        // No explicit end/close needed; stream closes when function exits
      },
    });
  } catch (error) {
    console.error('Orchestration failed:', error);
    return errorResponse('Orchestration process failed', 500);
  }
}

async function decideNextStep(orchestratorModel: LanguageModel, currentMessages: any[], customInfo: string): Promise<StepInstruction> {
  const { object } = await generateObject({
    model: orchestratorModel,
    schema: StepInstructionSchema,
    system: ORCHESTRATOR_PROMPT(customInfo),
    messages: currentMessages as any,
  });
  return object;
}

async function executeWorkerStep(
    stepInstruction: StepInstruction,
    workerModel: LanguageModel
): Promise<BrowserResult | TerminalResult | ErrorResult> {
  let workerTools: Record<string, any> = {};
  let workerSystemPrompt: string = '';
  let clientToClose: any = null;

  try {
    console.log(`Loading tools for worker type: ${stepInstruction.type}`);
    if (stepInstruction.type === 'browser') {
      const { playwrightTools, playwrightClient } = await getPlaywrightTools();
      workerTools = playwrightTools;
      workerSystemPrompt = BROWSER_AGENT_PROMPT();
      clientToClose = playwrightClient;
      console.log("Loaded Browser Tools:", Object.keys(workerTools));
    } else if (stepInstruction.type === 'terminal') {
      const { propsTools, propsClient } = await getPropsTools();
      workerTools = propsTools;
      workerSystemPrompt = TERMINAL_AGENT_PROMPT();
      clientToClose = propsClient;
      console.log("Loaded Terminal Tools:", Object.keys(workerTools));
    } else {
       // Should not happen if called correctly from orchestrate
        throw new Error(`Invalid worker type specified: ${stepInstruction.type}`);
    }

    if (Object.keys(workerTools).length === 0) {
      throw new Error(`No tools were loaded for worker type '${stepInstruction.type}'. Ensure tools are available.`);
    }

    console.log(`Calling worker (${stepInstruction.type}) with instruction: ${stepInstruction.instruction}`);
    const workerMessages = [
      { role: 'system', content: workerSystemPrompt },
      { role: 'user', content: stepInstruction.instruction }
    ] as any;

    const workerResult = await streamText({
      model: workerModel,
      messages: workerMessages,
      tools: workerTools,
      maxSteps: 5,
    });

    let fullResponse = '';
    for await (const delta of workerResult.textStream) {
      fullResponse += delta;
    }

    const toolCalls = await workerResult.toolCalls;
    const toolResults = await workerResult.toolResults;

    console.log(`Worker (${stepInstruction.type}) finished. Response length: ${fullResponse.length}`);
    if(toolCalls) console.log(`Worker (${stepInstruction.type}) tool calls: ${toolCalls.length}`);
    if(toolResults) console.log(`Worker (${stepInstruction.type}) tool results: ${toolResults.length}`);

    const result: BrowserResult | TerminalResult = {
      content: fullResponse,
      toolCalls: toolCalls || [],
      toolResults: toolResults || [],
    };

    return result;

  } catch (error) {
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    console.error(`Error during worker execution (${stepInstruction.type}):`, errorMessage, error);
    return { error: errorMessage } as ErrorResult;
  } finally {
    if (clientToClose) {
      try {
        await clientToClose.close();
        console.log(`Closed client for ${stepInstruction.type}.`);
      } catch (closeError) {
        console.error(`Error closing client for ${stepInstruction.type}:`, closeError);
      }
    }
  }
}