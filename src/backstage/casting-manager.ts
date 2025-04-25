// Central registry for models and tools, now as a class manager

// Only import createOpenAI as all models will use this via the proxy
import { createOpenAI } from '@ai-sdk/openai'; 
// Removed createAnthropic and createGoogleGenerativeAI imports
import { createAnthropic } from '@ai-sdk/anthropic';
import { experimental_createMCPClient, LanguageModel, streamText } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

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
  'gpt-4.1-nano',
  'grok-3-latest',
  'o3',
  'gpt-4.1'
];

const claudeModels = [
  'claude-3-5-sonnet-latest',
  'claude-3-7-sonnet-20250219',
];

// --- Tool Registry with Labels (Includes pseudo-tool for Playwright) --- 
const toolRegistry = {
  playwright: { // Pseudo-tool key for enabling Playwright
    label: 'Browser Control',
    tool: null, // No actual static tool, just used for selection
  },
  // computer: {
  //   label: 'Computer Use',
  //   tool: computerUseTool,
  // },
  // bash: {
  //   label: 'Bash',
  //   tool: bashTool,
  // },
  // str_replace_editor: {
  //   label: 'Text Editor',
  //   tool: textEditorTool,
  // },
  props: { // Pseudo-tool key for enabling Props SSH commands
    label: 'Terminal Execution',
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
  // Add private members to hold the clients
  private playwrightClient: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;
  private propsClient: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;

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
  // Reset all state, including clients
  reset() {
    this.model = null;
    this.tools = {};
    this.systemPrompt = '';
    // Ensure clients are reset as well
    this.playwrightClient = null;
    this.propsClient = null;
  }

  // New method to load tools based on selection
  async loadSelectedTools(selectedToolKeys: string[] | undefined): Promise<Record<string, any>> {
    const loadedTools: Record<string, any> = {};
    this.playwrightClient = null; // Reset clients before loading
    this.propsClient = null;

    if (!selectedToolKeys || !Array.isArray(selectedToolKeys)) {
      console.log('No tool keys provided or invalid format.');
      return loadedTools;
    }

    // Check if playwright tool is selected
    if (selectedToolKeys.includes('playwright')) {
      console.log('Playwright tool selected. Loading playwright tools...');
      try {
        const { playwrightTools: dynamicTools, playwrightClient: client } = await getPlaywrightTools();
        this.playwrightClient = client; // Store the client
        console.log('Playwright tools loaded:', Object.keys(dynamicTools));
        Object.assign(loadedTools, dynamicTools); // Merge playwright tools
      } catch (error) {
        console.error('Failed to load playwright tools:', error);
        // Continue without playwright tools
      }
    }

    // Check if props tool is selected
    if (selectedToolKeys.includes('props')) {
      console.log('Props tool selected. Loading props tools...');
      try {
        const { propsTools: dynamicTools, propsClient: client } = await getPropsTools();
        this.propsClient = client; // Store the client
        console.log('Props tools loaded:', Object.keys(dynamicTools));
        Object.assign(loadedTools, dynamicTools); // Merge props tools
      } catch (error) {
        console.error('Failed to load props tools:', error);
        // Continue without props tools
      }
    }

    // Add selected *static* tools to the tools object
    console.log('Adding selected static tools...');
    selectedToolKeys.forEach((toolKey: string) => {
      // Skip the dynamic tool keys handled above
      if (toolKey === 'playwright' || toolKey === 'props') return;

      const tool = this.getToolByKey(toolKey); // Use instance method
      if (tool) {
        loadedTools[toolKey] = tool;
        console.log(`Static tool added: ${toolKey}`);
      } else {
        console.log(`Static tool not found or invalid: ${toolKey}`);
      }
    });

    console.log('Final tools list loaded by CastingManager:', Object.keys(loadedTools));
    this.tools = loadedTools; // Update the manager's internal tools state as well
    return loadedTools; // Return the combined tools
  }

  // New method to close clients
  async closeClients() {
    if (this.playwrightClient || this.propsClient) {
      console.log('Closing clients managed by CastingManager...');
      try {
        if (this.playwrightClient) {
          await this.playwrightClient.close();
          console.log('Playwright client closed by CastingManager.');
          this.playwrightClient = null;
        }
      } catch (error) {
        console.error('Error closing Playwright client:', error);
      }
      try {
        if (this.propsClient) {
          await this.propsClient.close();
          console.log('Props client closed by CastingManager.');
          this.propsClient = null;
        }
      } catch (error) {
        console.error('Error closing Props client:', error);
      }
    } else {
       console.log('No active clients to close in CastingManager.');
    }
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
      onFinish: async (result: any) => {
        if (onFinish) {
          await onFinish(result);
        }
        await this.closeClients();
      },
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
