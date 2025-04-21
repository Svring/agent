// Central registry for models and tools, now as a class manager

import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { computerUseTool } from '@/tools/static/computer-use';
import { addTextTool } from '@/tools/static/add-text';
import { getInformationTool } from '@/tools/static/get-information';
import { workflowUseTool } from '@/tools/static/workflow-use/workflow-use';
import { bashTool } from '@/tools/static/bash';
import { textEditorTool } from '@/tools/static/text-editor';
import { reportTool } from '@/tools/static/report';
import { askForConfirmationTool } from '@/tools/static/ask-confirm';
import { experimental_createMCPClient } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { streamText } from 'ai';

// --- Model Factories ---
const modelFactories = {
  anthropicClaude: (modelName = 'claude-3-5-sonnet-20241022') => anthropic(modelName),

  sealosQwen: (modelName = 'qwen-vl-plus-latest') => {
    const sealos = createOpenAI({
      name: 'sealos',
      baseURL: process.env.SEALOS_BASE_URL,
      apiKey: process.env.SEALOS_API_KEY,
    });
    return sealos(modelName);
  },

  claudeProxy: (modelName = 'claude-3-5-sonnet-20241022') => {
    const claudeProxy = createAnthropic({
      baseURL: process.env.CLAUDE_PROXY_BASE_URL,
      apiKey: process.env.CLAUDE_PROXY_API_KEY,
    });
    return claudeProxy(modelName);
  },
};

// --- Tool Registry ---
const staticTools = {
  computer: computerUseTool,
  workflow: workflowUseTool,
  bash: bashTool,
  str_replace_editor: textEditorTool,
  addTextTool,
  getInformationTool,
  report: reportTool,
  askForConfirmation: askForConfirmationTool,
};

// --- Playwright Tools Helper ---
async function getPlaywrightTools() {
  const playwrightTransport = new Experimental_StdioMCPTransport({
    command: 'node',
    args: ['src/tools/mcp/playwright.mjs'],
  });
  const playwrightClient = await experimental_createMCPClient({
    transport: playwrightTransport,
  });
  const playwrightTools = await playwrightClient.tools();
  return { playwrightTools, playwrightClient };
}

// --- CastingManager Class ---
/**
 * Manages models, tools, system prompt, and other state for casting tasks.
 * Can be extended for session-based or multi-user scenarios.
 */
export class CastingManager {
  private model: any = null;
  private tools: Record<string, any> = { ...staticTools };
  private systemPrompt: string = '';

  // Setters
  setModel(model: any) {
    this.model = model;
  }
  setTools(tools: Record<string, any>) {
    this.tools = tools;
  }
  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
  }
  // Reset all state
  reset() {
    this.model = null;
    this.tools = { ...staticTools };
    this.systemPrompt = '';
  }

  // Flexible cast method
  /**
   * Casts (executes) a request with the given components, or falls back to current state.
   * @param {Object} options - { model, tools, systemPrompt, messages, ...streamTextOptions }
   * @returns {Promise<any>} - The result of streamText
   */
  async cast({
    model,
    tools,
    systemPrompt,
    messages,
    maxSteps = 20,
    toolCallStreaming = true,
    onError,
    onFinish,
    ...rest
  }: {
    model?: any,
    tools?: Record<string, any>,
    systemPrompt?: string,
    messages: any,
    maxSteps?: number,
    toolCallStreaming?: boolean,
    onError?: any,
    onFinish?: any,
    [key: string]: any
  }) {
    const usedModel = model || this.model;
    const usedTools = tools || this.tools;
    const usedPrompt = systemPrompt || this.systemPrompt;
    if (!usedModel) throw new Error('No model specified for casting');
    return streamText({
      model: usedModel,
      system: usedPrompt,
      messages,
      tools: usedTools,
      maxSteps,
      toolCallStreaming,
      onError,
      onFinish,
      ...rest,
    });
  }

  // Expose factories and helpers for external selection
  getModelFactories() {
    return modelFactories;
  }
  getStaticTools() {
    return staticTools;
  }
  async getPlaywrightTools() {
    return getPlaywrightTools();
  }
}

// --- Singleton instance for now (can be extended to session-based) ---
export const castingManager = new CastingManager();

// For backward compatibility (automation/route, opera/route):
export const models = modelFactories;
export const tools = staticTools;
export { getPlaywrightTools };
