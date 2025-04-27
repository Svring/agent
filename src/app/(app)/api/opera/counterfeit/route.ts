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
const BROWSER_AGENT_PROMPT = (customInfo?: string) => `You are an expert browser agent. Execute the user's instruction using the available browser tools.

${customInfo}`;

const TERMINAL_AGENT_PROMPT = (customInfo?: string) => `You are an expert terminal agent. Execute the user's instruction using the available terminal tools.

${customInfo}`;

// --- Orchestrator System Prompt ---
const ORCHESTRATOR_PROMPT = (customInfo?: string) => `You are an orchestrator agent. Your goal is to break down the user's request into sequential steps to achieve the objective.
Based on the conversation history (including previous steps, results, and errors), decide the *next single step*.

You have access to specialized agents:
- **Browser Agent**: Can interact with web pages (navigate, click, extract information, etc.). Delegate any web-related tasks to this agent using the 'browser' step type.
- **Terminal Agent**: Can execute commands on the user's file system. Delegate any file system operations or command-line tasks to this agent using the 'terminal' step type.

Choose one of the following step types for the *next single action*:
1.  **reason**: Provide reasoning, interpretation, or an intermediate plan update based on the current state. The instruction content *is* the reasoning itself. Use this for internal thought processes or summarizing progress.
2.  **browser**: Delegate a task requiring web interaction to the browser agent. Formulate a clear, actionable instruction for it (e.g., "Navigate to google.com and search for 'AI SDK'").
3.  **terminal**: Delegate a task requiring command-line execution to the terminal agent. Formulate a clear, actionable instruction for it (e.g., "List the files in the current directory using 'ls -la'").
4.  **answer**: Provide the final answer if the request is fully addressed or the goal is achieved. The instruction content *is* the final answer.

Provide only the chosen step type and the corresponding instruction for that single step.

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
    const maxOrchestrationSteps = 10;
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