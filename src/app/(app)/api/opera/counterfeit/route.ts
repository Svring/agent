import { castingManager } from '@/backstage/casting-manager';
import { streamText, streamObject, createDataStreamResponse, LanguageModel, Message as AIMessage, generateId, generateObject, generateText } from 'ai';
import {
  PlanStepInstructionSchema,
  PlanStepInstruction,
  PlanStep,
  CounterMessagesSchema,
  Message,
  MessageSchema,
  ToolInvocation
} from '@/models/chatSchemas';
import { errorResponse } from '../utils';
import { saveSessionMessages } from '@/db/actions/sessions-actions';
import { getAuthenticatedUserId } from '@/lib/auth-utils';
import { NextRequest } from 'next/server';

// Define a type for AI library message format (different from our app's Message type)
type AILibraryMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

// Define constants at the top level
const MAX_ORCHESTRATION_STEPS = 20;

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

// --- Orchestrator System Prompts ---
const ORCHESTRATOR_PROMPT = (customInfo?: string) => `You are an orchestrator agent. Your goal is to break down the user's request into sequential steps to achieve the objective.
Based on the conversation history (including previous steps, results, and errors), decide the *next single step's high-level goal*.

You have access to specialized agents:
- **Browser Agent**: Can control a web browser. It can navigate to URLs, take screenshots, click buttons/links (identified by coordinates), type text, scroll, and perform other interactions on a web page. Delegate web-related tasks to this agent using the 'browser' step type. Describe the desired outcome or action clearly (e.g., "Find the main headline on the BBC News homepage", "Log into the user's account on example.com").
- **Terminal Agent**: Can execute commands on the user's file system. Delegate file system operations or command-line tasks to this agent using the 'terminal' step type. Describe the task clearly (e.g., "List the files in the project's source directory"). Do *not* specify the exact commands (like 'mkdir').

Choose one of the following step types for the *next single action's goal*:
1.  **reason**: Provide reasoning, interpretation, or an intermediate plan update based on the current state. The instruction content *is* the reasoning itself. Use this for internal thought processes or summarizing progress.
2.  **browser**: Delegate a task requiring web interaction to the browser agent. Formulate a clear, high-level task description for it (e.g., "Search for recent AI news on Google and summarize the top 3 results"). Do *not* specify exact clicks or commands.
3.  **terminal**: Delegate a task requiring command-line execution to the terminal agent. Formulate a clear, high-level task description for it (e.g., "Create a new directory named 'docs' in the root folder"). Do *not* specify the exact commands (like 'mkdir').
4.  **answer**: Provide the final answer if the request is fully addressed or the goal is achieved. The instruction content *is* the final answer.

Provide only the chosen step type and the corresponding high-level instruction/task description for that single step. The specialized agent will determine the specific actions needed.

${customInfo}`;

// Final summary prompt
const SUMMARY_PROMPT = (customInfo?: string) => `You are presenting a final summary of a multi-step AI task execution process.
Review the completed plan steps and provide a comprehensive but concise summary of what was done and what was achieved.

Your summary should:
1. Briefly state the original goal/task
2. Highlight the key steps that were taken
3. Summarize what was learned or accomplished
4. Note any important outcomes or findings
5. Mention any significant challenges or errors encountered (if any)

Present this summary in a clear, direct way that gives the user a complete understanding of what happened during the execution.

${customInfo}`;

// --- Helpers ---
function createAssistantMessage(content: string): Message {
  return {
    id: generateId(),
    role: 'assistant',
    content,
    parts: [{ type: 'text', text: content }],
    createdAt: new Date(),
    annotations: [],
  };
}

// Add an extended Message type that includes plan
type MessageWithPlan = Message & { plan?: PlanStep[] };

interface CounterfeitRequestBody {
    messages: AIMessage[];
    model: string;
    customInfo?: string;
    sessionId: string; // This is the chat session ID from the DB
    // We will get the actual user ID from the authenticated session
}

export async function POST(req: NextRequest) {
  console.log("--- Counterfeit API Request Start ---");
  
  let authenticatedUserId: string | null = null;
  let requestBody: CounterfeitRequestBody | null = null;
  let actionForLog: string = 'counterfeitProcessing'; // For logging

  try {
    authenticatedUserId = await getAuthenticatedUserId(req.headers);
    if (!authenticatedUserId) {
      console.error("[Counterfeit API] Authentication failed or no user ID found in session.");
      return errorResponse('Authentication required.', 401);
    }
    console.log(`[Counterfeit API] Authenticated User ID: ${authenticatedUserId}`);

    requestBody = await req.json();
    const { messages: initialMessages, model: selectedModelName, customInfo, sessionId } = requestBody!;

    // It's good practice to log what sessionId (from body) and authenticatedUserId (from session) are.
    // You might also want to verify that the authenticatedUser is authorized to operate on this specific sessionId if they are different concepts.
    console.log(`[Counterfeit API] Request for DB sessionId: ${sessionId} by User ID: ${authenticatedUserId}`);

    if (!sessionId) {
      return errorResponse('sessionId (database chat session ID) is required in the request body', 400);
    }

    const workerModel = castingManager.getModelByName(selectedModelName);
    if (!workerModel) {
      console.error(`Error: Invalid or unavailable worker model selected: ${selectedModelName}`);
      return errorResponse(`Invalid or unavailable worker model selected: ${selectedModelName}`, 400);
    }
    console.log(`Selected Worker Model: ${selectedModelName}`);

    return createDataStreamResponse({
      async execute(dataStream) {
        const plan: PlanStep[] = [];
        // Keep track of user messages for history context, but don't add intermediate assistant messages
        const conversationHistory: Message[] = [...initialMessages.map((m: any) => ({
          id: m.id || generateId(),
          role: m.role || 'user',
          content: m.content || '',
          parts: m.parts || [{ type: 'text', text: m.content || ''}],
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          annotations: m.annotations || [],
        }))];
        // This will only contain the final summary message from the orchestrator
        const finalMessages: MessageWithPlan[] = [...conversationHistory as MessageWithPlan[]];
        let currentStepNumber = 0;

        const writeValidatedData = (step: number) => {
          currentStepNumber = step;
          const dataToWrite = {
            plan: [...plan],
            finalMessages,
            step: currentStepNumber
          };
          console.log("Writing validated data to stream:", JSON.stringify(dataToWrite, null, 2));
          const validationResult = CounterMessagesSchema.safeParse(dataToWrite);
          if (!validationResult.success) {
            console.error("Counterfeit Stream Data Validation Error:", validationResult.error.flatten());
          }
          dataStream.writeData(dataToWrite as any);
        };

        const orchestratorModelName = 'o3';
        const orchestratorModel = castingManager.getModelByName(orchestratorModelName);

        if (!orchestratorModel) {
          console.error(`Failed to create orchestrator model: ${orchestratorModelName}`);
          dataStream.writeData({ error: `Orchestrator model '${orchestratorModelName}' could not be created.` } as any);
        } else {
          console.log("Orchestrator Model Created.");
          
          // PHASE 1: Build the plan step by step
          console.log("\n--- PHASE 1: Building Plan ---");
          
          // Collect orchestrator context messages (without adding to finalMessages)
          const orchestratorContextMessages: AILibraryMessage[] = 
            conversationHistory.map(m => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content
            }));
          
          for (let i = 0; i < MAX_ORCHESTRATION_STEPS; i++) {
            console.log(`\n--- Orchestration Step ${i + 1} Start ---`);
            let stepInstruction: PlanStepInstruction;
            try {
              console.log("Calling Orchestrator with context messages");
              const { object } = await generateObject({
                model: orchestratorModel,
                schema: PlanStepInstructionSchema,
                system: ORCHESTRATOR_PROMPT(customInfo),
                messages: orchestratorContextMessages,
              });
              stepInstruction = await object;
              console.log("Orchestrator Decided Step Instruction:", JSON.stringify(stepInstruction, null, 2));
            } catch (decideErr) {
              const errorMessage = decideErr instanceof Error ? decideErr.message : String(decideErr);
              console.error(`[Orchestrator Error] Failed to decide next step: ${errorMessage}`, decideErr);
              plan.push({
                step: i + 1,
                instruction: { type: 'reason', instruction: 'Error: Orchestrator failed to generate instruction.' },
                report: `Error: Orchestrator failed to decide next step: ${errorMessage}`,
                invocations: []
              });
              writeValidatedData(i + 1);
              break;
            }

            // Create the plan step
            const planStep: PlanStep = {
              step: i + 1,
              instruction: stepInstruction,
              report: "",
              invocations: []
            };
            plan.push(planStep);
            console.log(`Added step ${planStep.step} to plan (Report pending).`);

            // If this is an "answer" type step, we're done - this is the final summary
            if (stepInstruction.type === 'answer') {
              planStep.report = stepInstruction.instruction;
              // Add this answer to orchestrator context so it's considered in the final summary
              const answerMsg: AILibraryMessage = {
                role: 'assistant',
                content: `Final Answer: ${stepInstruction.instruction}`
              };
              orchestratorContextMessages.push(answerMsg);
              writeValidatedData(i + 1);
              break;
            }

            console.log(`Executing Step Type: ${stepInstruction.type}`);
            try {
              switch (stepInstruction.type) {
                case 'reason':
                  console.log("Executing Reason Step.");
                  planStep.report = stepInstruction.instruction;
                  // Add the reasoning to orchestrator context but NOT to finalMessages
                  const reasoningMsg: AILibraryMessage = {
                    role: 'assistant',
                    content: `Reasoning: ${stepInstruction.instruction}`
                  };
                  orchestratorContextMessages.push(reasoningMsg);
                  break;
                case 'browser':
                case 'terminal':
                  console.log(`Executing Worker Step: ${stepInstruction.type}`);
                  const workerOutput = await executeWorkerStep(
                    stepInstruction, 
                    workerModel!, 
                    customInfo, 
                    authenticatedUserId === null ? undefined : authenticatedUserId 
                  );
                  planStep.report = workerOutput.report;
                  if (workerOutput.invocations && workerOutput.invocations.length > 0) {
                    planStep.invocations = workerOutput.invocations;
                  }
                  const isError = planStep.report.toLowerCase().startsWith("error:");
                  let summaryCtxMessage = `${stepInstruction.type.charAt(0).toUpperCase() + stepInstruction.type.slice(1)} Agent: ${planStep.report}`;
                  if (!isError && planStep.invocations && planStep.invocations.length > 0 && !planStep.report.includes("tool invocation(s)")) {
                    summaryCtxMessage = `${stepInstruction.type.charAt(0).toUpperCase() + stepInstruction.type.slice(1)} Agent used ${planStep.invocations.length} tool(s). Report: ${planStep.report}`;
                  }
                  orchestratorContextMessages.push({ role: 'assistant', content: summaryCtxMessage });
                  break;
                default:
                  const unknownStepType = (stepInstruction as any).type;
                  console.error(`Unknown step type encountered: ${unknownStepType}`);
                  planStep.report = `Error: Unknown step type '${unknownStepType}' encountered.`;
                  const unknownTypeMsg: AILibraryMessage = {
                    role: 'assistant',
                    content: `Error: Unknown step type: ${unknownStepType}`
                  };
                  orchestratorContextMessages.push(unknownTypeMsg);
                  i = MAX_ORCHESTRATION_STEPS;
                  continue;
              }
            } catch (executionErr) {
              const errorMessage = executionErr instanceof Error ? executionErr.message : String(executionErr);
              console.error(`[Execution Error - ${stepInstruction.type}] ${errorMessage}`, executionErr);
              planStep.report = `Error: During ${stepInstruction.type} execution - ${errorMessage}`;
              const execErrorMsg: AILibraryMessage = {
                role: 'assistant',
                content: `Error executing ${stepInstruction.type} step: ${errorMessage}`
              };
              orchestratorContextMessages.push(execErrorMsg);
              writeValidatedData(i + 1);
              break;
            }
            writeValidatedData(i + 1);
            
            // Check if we've hit max steps
            if (i === MAX_ORCHESTRATION_STEPS - 1) {
              console.warn("Reached maximum orchestration steps.");
              const maxStepsReport = 'Error: Reached maximum orchestration steps.';
              plan.push({
                step: i + 2,
                instruction: { type: 'reason', instruction: 'Max steps reached.' },
                report: maxStepsReport,
                invocations: []
              });
              const maxStepsMsg: AILibraryMessage = {
                role: 'assistant',
                content: "Warning: Reached maximum number of steps without completion."
              };
              orchestratorContextMessages.push(maxStepsMsg);
              writeValidatedData(i + 2);
            }
            console.log(`--- Orchestration Step ${i + 1} End ---`);
          }
          
          // PHASE 2: Generate final summary
          console.log("\n--- PHASE 2: Generating Final Summary ---");
          
          try {
            const { text } = await generateText({
              model: orchestratorModel,
              system: SUMMARY_PROMPT(customInfo),
              messages: orchestratorContextMessages,
            });
            
            const summaryContent = await text;
            console.log("Generated Summary:", summaryContent);
            
            // Create the final summary message and add plan to it
            const summaryMessage = createAssistantMessage(summaryContent) as MessageWithPlan;
            summaryMessage.plan = plan;
            
            finalMessages.length = conversationHistory.length; // Reset to just user messages
            finalMessages.push(summaryMessage); // Add only the final summary
            
            // Write final data to the stream
            writeValidatedData(plan.length);
          } catch (summaryErr) {
            console.error("Error generating final summary:", summaryErr);
            const errorMessage = summaryErr instanceof Error ? summaryErr.message : String(summaryErr);
            const errorSummary = createAssistantMessage(`I encountered an error while generating the final summary: ${errorMessage}`);
            finalMessages.length = conversationHistory.length;
            finalMessages.push(errorSummary);
            writeValidatedData(plan.length);
          }
        }

        console.log("--- Orchestration Loop Finished ---");

        try {
          console.log(`[Counterfeit] Preparing to save ${finalMessages.length} messages for session ${sessionId}`);
          const messagesWithSession = finalMessages.map(msg => ({
            ...msg,
            session: sessionId,
            annotations: msg.annotations || [],
            experimental_attachments: msg.experimental_attachments || [], 
          }));

          const validatedMessages = messagesWithSession.filter(msg => {
            const { success, error } = MessageSchema.safeParse(msg);
            if (!success) {
              console.warn(`[Counterfeit] Message (ID: ${msg.id}) failed validation before save for session ${sessionId}:`, error.flatten());
              return false;
            }
            return true;
          });

          if (validatedMessages.length > 0) {
            const saveSuccess = await saveSessionMessages(sessionId, validatedMessages as any);
            if (!saveSuccess) {
              console.error(`[Counterfeit] Failed to save messages for session ${sessionId}`);
            } else {
              console.log(`[Counterfeit] Successfully saved ${validatedMessages.length} messages for session ${sessionId}`);
            }
          } else {
            console.log(`[Counterfeit] No valid messages to save for session ${sessionId} after filtering.`);
          }
        } catch (error) {
          console.error(`[Counterfeit] Error during final message saving for session ${sessionId}:`, error);
        }
        console.log("--- Data Stream Closing Gracefully (Counterfeit) ---");
      },
    });
  } catch (error) {
    const authUserIdForLog = authenticatedUserId || 'unknown';
    console.error(`[Counterfeit API] User [${authUserIdForLog}] Orchestration Failed Critically for action [${actionForLog}]:`, error);
    return errorResponse('Orchestration process failed', 500);
  }
}

async function executeWorkerStep(
  stepInstruction: PlanStepInstruction,
  workerModel: LanguageModel,
  customInfo?: string,
  userIdForTools?: string
): Promise<{ report: string; invocations: ToolInvocation[] }> {
  let workerTools: Record<string, any> = {};

  try {
    const toolProviderKey = stepInstruction.type === 'browser' ? 'playwright' : stepInstruction.type === 'terminal' ? 'props' : null;

    if (toolProviderKey && userIdForTools) {
      await castingManager.initializeUserSession(userIdForTools, undefined, [toolProviderKey]);
      const userConfig = (castingManager as any).getUserConfig(userIdForTools);
      workerTools = userConfig.tools;
      console.log(`[executeWorkerStep] User [${userIdForTools}] using tools: ${Object.keys(workerTools).join(', ') || 'None'} for type ${stepInstruction.type}`);
    } else if (toolProviderKey) {
      console.warn(`[executeWorkerStep] CRITICAL: No userIdForTools provided for a tool-based step (${stepInstruction.type}). Tool execution will likely fail or use a shared context.`);
    }

    if (Object.keys(workerTools).length === 0 && (stepInstruction.type === 'browser' || stepInstruction.type === 'terminal')) {
      throw new Error(`No tools were loaded or available for worker type '${stepInstruction.type}' for user [${userIdForTools || 'unknown'}].`);
    }

    let workerSystemPrompt = '';
    if (stepInstruction.type === 'browser') workerSystemPrompt = BROWSER_AGENT_PROMPT(customInfo);
    else if (stepInstruction.type === 'terminal') workerSystemPrompt = TERMINAL_AGENT_PROMPT(customInfo);
    
    const workerMessagesForAI: AILibraryMessage[] = [
      { role: 'system', content: workerSystemPrompt },
      { role: 'user', content: stepInstruction.instruction }
    ];

    const toolsForThisStep = (stepInstruction.type === 'browser' || stepInstruction.type === 'terminal') ? workerTools : undefined;

    const { steps } = await generateText({
      model: workerModel,
      messages: workerMessagesForAI,
      tools: toolsForThisStep,
      maxSteps: 5
    });
    
    const workerSteps = await steps;
    let finalContent = "";
    const finalInvocations: ToolInvocation[] = [];
    const toolCallMapForInvocations = new Map<string, ToolInvocation>();

    for (const step of workerSteps) {
      if (step.text) finalContent = step.text;
      if (step.toolCalls) {
        for (const call of step.toolCalls) {
          const invocation: ToolInvocation = { toolCallId: call.toolCallId, toolName: call.toolName, args: call.args, state: 'call' };
          if (!toolCallMapForInvocations.has(call.toolCallId)) {
            finalInvocations.push(invocation);
            toolCallMapForInvocations.set(call.toolCallId, invocation);
          }
        }
      }
      if (step.toolResults) {
        for (const res of step.toolResults) {
          const existingInvocation = toolCallMapForInvocations.get(res.toolCallId);
          if (existingInvocation) {
            existingInvocation.result = res.result;
            existingInvocation.state = 'result'; 
          } else {
            finalInvocations.push({ toolCallId: res.toolCallId, toolName: res.toolName, args: {}, state: 'result', result: res.result });
          }
        }
      }
    }

    let finalReportString = finalContent;
    if (!finalReportString && finalInvocations.length > 0) {
      finalReportString = `${stepInstruction.type.charAt(0).toUpperCase() + stepInstruction.type.slice(1)} agent completed task using ${finalInvocations.length} tool invocation(s).`;
    } else if (!finalReportString) {
      finalReportString = `${stepInstruction.type.charAt(0).toUpperCase() + stepInstruction.type.slice(1)} agent completed task with no specific textual output.`;
    }
    return { report: finalReportString, invocations: finalInvocations };
  } catch (error) {
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    console.error(`[executeWorkerStep] User [${userIdForTools || 'unknown'}] Error:`, error);
    return { report: `Error: During ${stepInstruction.type} worker execution for user [${userIdForTools || 'unknown'}] - ${errorMessage}`, invocations: [] };
  }
}