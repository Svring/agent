import { castingManager, getPlaywrightTools, getPropsTools } from '@/backstage/casting-manager';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, streamText, streamObject, createDataStreamResponse, LanguageModel, Message, generateId } from 'ai';
import {
  PlanStepInstructionSchema,
  PlanStepInstruction,
  ReasonResult,
  BrowserResult,
  TerminalResult,
  AnswerResult,
  ErrorResult,
  PlanStep,
  PlanStepResult
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
- **props_launch_dev**: **Use this specific tool** to start the \'npm run dev\' development server in the background within a specific directory. Requires the 'projectRoot' parameter (absolute path).
- **props_check_dev_status**: Check if the \'npm run dev\' process is currently running.
- **props_read_dev_log**: Read the content of the dev server log file ('npm_dev.log') from a specific directory. Requires the 'projectRoot' parameter (absolute path).
- **props_read_command_log**: Read the log of previously executed commands, including timestamps and outputs.
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

// Helper to create structured assistant messages
function createAssistantMessage(content: string): Message {
  return {
    id: generateId(),
    role: 'assistant',
    content,
    parts: [{ type: 'text', text: content }],
  };
}

export async function POST(req: Request) {
  console.log("--- Counterfeit API Request Start ---");
  const body = await req.json();
  console.log("Request Body:", JSON.stringify(body, null, 2));
  const { messages: initialMessages, model: selectedModelName, customInfo } = body;

  const workerModel = castingManager.getModelByName(selectedModelName);
  if (!workerModel) {
    console.error(`Error: Invalid or unavailable model selected: ${selectedModelName}`);
    return errorResponse(`Invalid or unavailable model selected: ${selectedModelName}`, 400);
  }
  console.log(`Selected Worker Model: ${selectedModelName}`);

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
        console.log("Orchestrator Model Created.");

        for (let i = 0; i < maxOrchestrationSteps; i++) {
          console.log(`\n--- Orchestration Step ${i + 1} Start ---`);
          // 1) Decide the next step via orchestrator
          let stepInstruction: PlanStepInstruction;
          try {
            console.log("Calling Orchestrator with messages:", JSON.stringify(currentMessages, null, 2));
            const { partialObjectStream, object } = await streamObject({
              model: orchestratorModel,
              schema: PlanStepInstructionSchema,
              system: ORCHESTRATOR_PROMPT(customInfo),
              messages: currentMessages as any,
            });
            // Optional: Log partial objects if needed for fine-grained debugging
            for await (const partialObject of partialObjectStream) {
              // console.log('Orchestrator Partial Object:', partialObject);
            }
            stepInstruction = await object;
            console.log("Orchestrator Decided Step Instruction:", JSON.stringify(stepInstruction, null, 2));
          } catch (decideErr) {
            const errorMessage = decideErr instanceof Error ? decideErr.message : String(decideErr);
            console.error(`[Orchestrator Error] Failed to decide next step: ${errorMessage}`, decideErr);
            plan.push({
              step: i + 1,
              instruction: { type: 'reason', instruction: 'Error: Orchestrator failed to generate instruction.' },
              result: { error: errorMessage } as PlanStepResult,
            });
            currentMessages.push(createAssistantMessage(`[Orchestrator Error] Failed to decide next step: ${errorMessage}`));
            // Stream the current plan and messages
            console.log("Streaming orchestrator error data...");
            dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });
            break; // Exit loop on orchestrator error
          }

          // 2) Record the step skeleton in the plan (result added later)
          const planStep: PlanStep = {
            step: i + 1,
            instruction: stepInstruction,
          };
          plan.push(planStep);
          console.log(`Added step ${planStep.step} to plan (Result pending).`);

          const stepInstructionMessage = createAssistantMessage(
            `[Orchestrator] Planning step ${i + 1}: ${stepInstruction.type}. Instruction: ${stepInstruction.instruction}`
          );

          currentMessages.push(stepInstructionMessage);

          // 3) Execute step based on type
          console.log(`Executing Step Type: ${stepInstruction.type}`);
          try {
            switch (stepInstruction.type) {
              case 'reason':
                console.log("Executing Reason Step.");
                const reasonResult: ReasonResult = {
                  content: stepInstruction.instruction,
                };
                planStep.result = reasonResult;
                // Construct a Message object for currentMessages (keeping parts here)
                currentMessages.push(createAssistantMessage(`[Reasoning] ${stepInstruction.instruction}`));
                break;
              case 'answer':
                console.log("Executing Answer Step.");
                const answerResult: AnswerResult = {
                  content: stepInstruction.instruction,
                };
                planStep.result = answerResult;
                // Construct a Message object for currentMessages (keeping parts here)
                currentMessages.push(createAssistantMessage(stepInstruction.instruction));
                // Stream the final plan and messages
                dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });
                i = maxOrchestrationSteps; // End the loop
                continue;
              case 'browser':
              case 'terminal':
                console.log(`Executing Worker Step: ${stepInstruction.type}`);
                const workerResult = await executeWorkerStep(stepInstruction, workerModel);
                planStep.result = workerResult;
                console.log(`Worker (${stepInstruction.type}) Result:`, JSON.stringify(workerResult, null, 2));

                if ('error' in workerResult) {
                  console.error(`[Worker Error - ${stepInstruction.type}] ${workerResult.error}`);
                  currentMessages.push(createAssistantMessage(`[Worker Error - ${stepInstruction.type}] ${workerResult.error}`));
                  // Stream the current plan and messages
                  console.log("Streaming worker error data...");
                  dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });
                  i = maxOrchestrationSteps; // End the loop on worker error
                  continue;
                } else {
                  // Create the base message with the worker's text summary
                  const workerResultMessage = createAssistantMessage(`[${stepInstruction.type} Result] ${workerResult.content}`);
                  // Assert that parts is defined (guaranteed by createAssistantMessage)
                  const messageParts = workerResultMessage.parts!;

                  // Check for tool interactions and add them as structured parts
                  if ('toolCalls' in workerResult && workerResult.toolCalls && workerResult.toolCalls.length > 0 &&
                      'toolResults' in workerResult && workerResult.toolResults) {

                    console.log(`Structuring ${workerResult.toolCalls.length} tool calls/results into message parts.`);

                    // Map results by toolCallId for easy lookup
                    const resultsMap = new Map<string, any>(); // Using any for ToolResult temporarily
                    workerResult.toolResults.forEach(result => {
                      if (result.toolCallId) {
                        resultsMap.set(result.toolCallId, result);
                      }
                    });

                    // Add tool invocation parts to the message
                    workerResult.toolCalls.forEach(call => {
                      // Find the corresponding tool result
                      const result = resultsMap.get(call.toolCallId);
                      if (result) {
                        // Add only the tool result part
                        console.log(`Adding tool result part for call ID: ${call.toolCallId}`);
                        messageParts.push({
                          type: 'tool-invocation',
                          toolInvocation: { state: 'result', ...result } as any // Cast to ToolInvocation structure
                        });
                      } else {
                        // Optionally log if a result is missing for a call
                        console.warn(`No corresponding result found for tool call ID: ${call.toolCallId}`);
                      }
                    });
                  }

                  // Add the potentially augmented message to the history
                  currentMessages.push(workerResultMessage);
                }
                break;
              default:
                console.error(`Unknown step type encountered: ${(stepInstruction as any).type}`);
                throw new Error(`Unknown step type: ${(stepInstruction as any).type}`);
            }
          } catch (executionErr) {
            const errorMessage = executionErr instanceof Error ? executionErr.message : String(executionErr);
            console.error(`[Execution Error - ${stepInstruction.type}] ${errorMessage}`, executionErr);
            planStep.result = { error: errorMessage };
            currentMessages.push(createAssistantMessage(`[Execution Error - ${stepInstruction.type}] ${errorMessage}`));
            // Stream the current plan and messages
            console.log("Streaming execution error data...");
            dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });
            break; // Exit loop on execution error
          }

          // 4) Stream the current plan and messages after each step
          console.log(`Streaming data after step ${i + 1} completion.`);
          dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 1 });

          // 5) Safeguard against infinite loops
          if (i === maxOrchestrationSteps - 1 && planStep.result && !('error' in planStep.result)) {
            console.warn("Reached maximum orchestration steps.");
            const maxStepsError: ErrorResult = { error: 'Reached maximum orchestration steps.' };
            plan.push({
              step: i + 2,
              instruction: { type: 'reason', instruction: 'Max steps reached.' },
              result: maxStepsError as PlanStepResult,
            });
            currentMessages.push(createAssistantMessage(maxStepsError.error));
            console.log("Streaming max steps reached data...");
            dataStream.writeData({ plan: [...plan], finalMessages: [...currentMessages], step: i + 2 });
          }
          console.log(`--- Orchestration Step ${i + 1} End ---`);
        }
        console.log("--- Orchestration Loop Finished ---");
        // No explicit end/close needed; stream closes when function exits
        console.log("--- Data Stream Closing Gracefully ---");
      },
    });
  } catch (error) {
    console.error('--- Orchestration Failed Critically ---', error);
    return errorResponse('Orchestration process failed', 500);
  }
}

async function executeWorkerStep(
  stepInstruction: PlanStepInstruction,
  workerModel: LanguageModel
): Promise<PlanStepResult> {
  let workerTools: Record<string, any> = {};
  let workerSystemPrompt: string = '';
  let clientToClose: any = null;

  try {
    console.log(`executeWorkerStep: Loading tools for worker type: ${stepInstruction.type}`);
    if (stepInstruction.type === 'browser') {
      const { playwrightTools, playwrightClient } = await getPlaywrightTools();
      workerTools = playwrightTools;
      workerSystemPrompt = BROWSER_AGENT_PROMPT();
      clientToClose = playwrightClient;
      console.log("executeWorkerStep: Loaded Browser Tools:", Object.keys(workerTools));
    } else if (stepInstruction.type === 'terminal') {
      const { propsTools, propsClient } = await getPropsTools();
      workerTools = propsTools;
      workerSystemPrompt = TERMINAL_AGENT_PROMPT();
      clientToClose = propsClient;
      console.log("executeWorkerStep: Loaded Terminal Tools:", Object.keys(workerTools));
    } else {
      // This branch should ideally not be reached if stepInstruction.type is validated
      throw new Error(`Invalid worker type specified: ${stepInstruction.type}`);
    }

    if (Object.keys(workerTools).length === 0) {
      throw new Error(`No tools were loaded for worker type '${stepInstruction.type}'. Ensure tools are available.`);
    }

    console.log(`executeWorkerStep: Calling worker (${stepInstruction.type}) with instruction: ${stepInstruction.instruction}`);
    const workerMessages = [
      { role: 'system', content: workerSystemPrompt },
      { role: 'user', content: stepInstruction.instruction }
    ] as any;

    // Use streamText which provides structured steps, tool calls, and results
    const { steps, textStream } = await streamText({
      model: workerModel,
      messages: workerMessages,
      tools: workerTools,
      maxSteps: 5, // Adjust maxSteps as needed for multi-step tool use
    });

    for await (const chunk of textStream) {
      // This bloc feints the consumption of the textStream for unblocking the communication channel, do not remove it and wait for further optimizations.
    }

    // Process the structured steps
    const workerSteps = await steps;
    // console.log("--- Worker Steps Array ---");
    // console.log(JSON.stringify(workerSteps, null, 2)); // Use JSON.stringify for readability
    // console.log("------------------------");

    // --- Extract final content, tool calls, and tool results from steps --- 
    let finalContent = "";
    const allToolCalls: any[] = [];
    const allToolResults: any[] = [];

    for (const step of workerSteps) {
      // Capture the last text response as the summary content
      if (step.text) {
        finalContent = step.text; // Overwrite with later steps' text if available
      }
      // Aggregate tool calls and results
      if (step.toolCalls) {
        allToolCalls.push(...step.toolCalls);
      }
      if (step.toolResults) {
        allToolResults.push(...step.toolResults);
      }
    }

    if (!finalContent && workerSteps.length > 0) {
      // Fallback if the last step didn't have text (e.g., ended with tool call)
      finalContent = `Worker finished after ${workerSteps.length} steps.`;
      if (allToolCalls.length > 0) finalContent += ` Made ${allToolCalls.length} tool call(s).`;
    }
    // --- End Extraction --- 

    console.log(`executeWorkerStep: Worker (${stepInstruction.type}) finished. Extracted content length: ${finalContent.length}`);
    // Add checks for toolCalls and toolResults existence before logging
    if (allToolCalls.length > 0) console.log(`executeWorkerStep: Worker (${stepInstruction.type}) aggregated tool calls: ${allToolCalls.length}`);
    if (allToolResults.length > 0) console.log(`executeWorkerStep: Worker (${stepInstruction.type}) aggregated tool results: ${allToolResults.length}`);

    // Construct the result based on the type, ensuring properties align
    let result: PlanStepResult;
    if (stepInstruction.type === 'browser') {
      result = {
        content: finalContent,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
      } as BrowserResult;
    } else if (stepInstruction.type === 'terminal') {
      result = {
        content: finalContent,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
      } as TerminalResult;
    } else {
      // This should not happen based on the calling logic, but handle defensively
      console.error(`Unexpected step type in executeWorkerStep: ${stepInstruction.type}`);
      result = { error: `Unexpected step type encountered: ${stepInstruction.type}` } as ErrorResult;
    }

    // No need to cast here, as we've constructed the correct type
    return result;

  } catch (error) {
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    console.error(`Error during worker execution (${stepInstruction.type}):`, errorMessage, error);
    return { error: errorMessage } as PlanStepResult;
  } finally {
    if (clientToClose) {
      try {
        console.log(`executeWorkerStep: Attempting to close client for ${stepInstruction.type}...`);
        await clientToClose.close();
        console.log(`executeWorkerStep: Closed client for ${stepInstruction.type}.`);
      } catch (closeError) {
        console.error(`executeWorkerStep: Error closing client for ${stepInstruction.type}:`, closeError);
      }
    }
  }
}