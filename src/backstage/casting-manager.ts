// Central registry for models and tools, now as a class manager

// Only import createOpenAI as all models will use this via the proxy
import { createOpenAI } from '@ai-sdk/openai'; 
// Removed createAnthropic and createGoogleGenerativeAI imports
import { createAnthropic } from '@ai-sdk/anthropic';
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
import { LanguageModel } from 'ai';

// --- Unified Model Factory via OpenAI Proxy --- 

const createModelViaProxy = (modelName: string): LanguageModel => {
  // Use the standard Sealos USW endpoint for all models via OpenAI SDK
  const baseURL = process.env.SEALOS_USW_BASE_URL;
  console.log(`Creating model "${modelName}" via standard proxy URL: ${baseURL}`);
  
  const openai = createOpenAI({ 
    baseURL: baseURL, 
    apiKey: process.env.SEALOS_USW_API_KEY,
    // Ensure compatibility headers or settings are added if needed by the proxy
  }); 
  return openai(modelName);
};

// --- Anthropic Model Factory for Claude --- 

const createClaudeModel = (modelName: string): LanguageModel => {
  console.log(`Creating Claude model "${modelName}" directly via Anthropic SDK`);
  const anthropic = createAnthropic({
    apiKey: process.env.SEALOS_USW_API_KEY,
    // Use the same Sealos endpoint if needed, or default to Anthropic's endpoint
    baseURL: process.env.SEALOS_USW_BASE_URL,
  });
  return anthropic(modelName);
};

// --- Available Model Names --- 
const availableModelNames = [
  'claude-3-5-sonnet-latest',
  'claude-3-7-sonnet-20250219',
  'gemini-2.5-pro-exp-03-25',
  'gpt-4.1-nano',
  'grok-3-latest',
];

const claudeModels = [
  'claude-3-5-sonnet-latest',
  'claude-3-7-sonnet-20250219',
];

// --- Tool Registry with Labels (Includes pseudo-tool for Playwright) --- 
const toolRegistry = {
  playwright: { // Pseudo-tool key for enabling Playwright
    label: 'Web Browsing',
    tool: null, // No actual static tool, just used for selection
  },
  computer: {
    label: 'Computer Use',
    tool: computerUseTool,
  },
  workflow: {
    label: 'Workflow Use',
    tool: workflowUseTool,
  },
  bash: {
    label: 'Bash',
    tool: bashTool,
  },
  str_replace_editor: {
    label: 'Text Editor',
    tool: textEditorTool,
  },
  addTextTool: {
    label: 'Add Text',
    tool: addTextTool,
  },
  getInformationTool: {
    label: 'Get Information',
    tool: getInformationTool,
  },
  report: {
    label: 'Report',
    tool: reportTool,
  },
  askForConfirmation: {
    label: 'Ask for Confirmation',
    tool: askForConfirmationTool,
  },
  props: { // Pseudo-tool key for enabling Props SSH commands
    label: 'Remote Props (SSH)',
    tool: null, // No actual static tool, just used for selection
  },
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

// --- Props Tools Helper --- 
async function getPropsTools() {
  const propsTransport = new Experimental_StdioMCPTransport({
    command: 'node',
    args: ['src/tools/mcp/props.mjs'], // Path to the props tool
  });
  const propsClient = await experimental_createMCPClient({
    transport: propsTransport,
  });
  const propsTools = await propsClient.tools();
  return { propsTools, propsClient };
}

// --- CastingManager Class --- 
/**
 * Manages models, tools, system prompt, and other state for casting tasks.
 * Can be extended for session-based or multi-user scenarios.
 */
export class CastingManager {
  private model: LanguageModel | null = null;
  private tools: Record<string, any> = {};
  private systemPrompt: string = '';

  // Setters
  setModel(model: LanguageModel) {
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
    this.tools = {};
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
    model?: LanguageModel,
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

  // Methods to access models and tools
  getModelByName(modelName: string): LanguageModel | null {
    if (!availableModelNames.includes(modelName)) {
      console.warn(`Requested model name "${modelName}" is not available.`);
      return null;
    }

    try {
      // Use Anthropic SDK for Claude models
      if (claudeModels.includes(modelName)) {
        return createClaudeModel(modelName);
      }
      // Otherwise, use the unified proxy factory
      return createModelViaProxy(modelName);
    } catch (error) {
      console.error(`Failed to create model "${modelName}" via proxy:`, error);
      return null;
    }
  }

  getToolByKey(key: string) {
    // Exclude the pseudo-tool for playwright
    if (key === 'playwright') return null;
    return toolRegistry[key as keyof typeof toolRegistry]?.tool || null;
  }

  // Expose options for listing available options
  getModelOptions() {
    return availableModelNames.map(name => ({
      key: name,
      label: name, // Use name as label
    }));
  }

  getToolOptions() {
    // Return all entries from toolRegistry, including the pseudo-tool
    return Object.entries(toolRegistry).map(([key, tool]) => ({
      key,
      label: tool.label,
    }));
  }

  // Backward compatibility methods (tools only)
  getStaticTools() {
    const staticTools: Record<string, any> = {};
    Object.entries(toolRegistry).forEach(([key, tool]) => {
      // Exclude the pseudo-tools when getting actual static tools
      if (key !== 'playwright' && key !== 'props') {
        staticTools[key] = tool.tool;
      }
    });
    return staticTools;
  }

  async getPlaywrightTools() {
    return getPlaywrightTools();
  }

  async getPropsTools() {
    return getPropsTools();
  }
}

// --- Singleton instance for now (can be extended to session-based) --- 
export const castingManager = new CastingManager();

// For backward compatibility (tools only):
export const tools = toolRegistry;
export { getPlaywrightTools, getPropsTools };
