// Central registry for models and tools
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { experimental_createMCPClient, LanguageModel, streamText } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

// Import the computer tool
import { computerTool } from '@/tools/functions/computer';
// import { textEditorTool } from '@/tools/legacy/text-editor';

// Types
type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;
type ToolRegistry = Record<string, { label: string; tool: any | null }>;
type ToolCollection = Record<string, any>;

// Model configurations
const MODEL_CONFIG = {
  AVAILABLE_MODELS: [
    'claude-3-5-sonnet-latest',
    'claude-3-7-sonnet-20250219',
    'gemini-2.5-pro-preview-03-25',
    'gpt-4.1-nano',
    'grok-3-latest',
    'o3',
    'gpt-4.1',
  ],
  CLAUDE_MODELS: [
    'claude-3-5-sonnet-latest',
    'claude-3-7-sonnet-20250219',
  ],
};

// Tool registry configuration
const toolRegistry: ToolRegistry = {
  playwright: {
    label: 'Browser Control',
    tool: null, // Pseudo-tool for enabling Playwright
  },
  props: {
    label: 'Terminal Execution',
    tool: null, // Pseudo-tool for enabling Props SSH commands
  },
  // Add additional tools here when uncommented:
  // computer: { label: 'Computer Use', tool: computerUseTool },
  // bash: { label: 'Bash', tool: bashTool },
  // str_replace_editor: { label: 'Text Editor', tool: textEditorTool },
  computer: { label: 'Computer Use', tool: computerTool },
};

// Model Creation Helpers

const createModelViaProxy = (modelName: string): LanguageModel => {
  const baseURL = process.env.SEALOS_USW_BASE_URL;
  console.log(`Creating model "${modelName}" via standard proxy URL: ${baseURL}`);
  
  const openai = createOpenAI({ 
    baseURL, 
    apiKey: process.env.SEALOS_USW_API_KEY,
    compatibility: 'compatible'
  }); 
  return openai(modelName);
};

const createClaudeModel = (modelName: string): LanguageModel => {
  console.log(`Creating Claude model "${modelName}" directly via Anthropic SDK`);
  const anthropic = createAnthropic({
    apiKey: process.env.SEALOS_USW_API_KEY,
    baseURL: process.env.SEALOS_USW_BASE_URL,
  });
  return anthropic(modelName);
};

// Dynamic Tool Loading Helpers

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

async function getPropsTools() {
  const propsTransport = new Experimental_StdioMCPTransport({
    command: 'node',
    args: ['src/tools/mcp/props.mjs'],
  });
  const propsClient = await experimental_createMCPClient({
    transport: propsTransport,
  });
  const propsTools = await propsClient.tools();
  return { propsTools, propsClient };
}

// Dynamic tool loader mapping
const DYNAMIC_TOOL_LOADERS: Record<string, () => Promise<{ tools: ToolCollection; client: MCPClient }>> = {
  playwright: async () => {
    const { playwrightTools, playwrightClient } = await getPlaywrightTools();
    return { tools: playwrightTools, client: playwrightClient };
  },
  props: async () => {
    const { propsTools, propsClient } = await getPropsTools();
    return { tools: propsTools, client: propsClient };
  },
};

const DYNAMIC_TOOL_KEYS = Object.keys(DYNAMIC_TOOL_LOADERS);

// Cast method parameter interface
interface CastOptions {
  model?: LanguageModel;
  tools?: ToolCollection;
  systemPrompt?: string;
  messages: any;
  maxSteps?: number;
  toolCallStreaming?: boolean;
  onError?: (event: { error: unknown }) => void;
  onFinish?: (result: any) => void;
  [key: string]: any;
}

/**
 * Manages models, tools, system prompt, and other state for casting tasks.
 * Can be extended for session-based or multi-user scenarios.
 */
export class CastingManager {
  private model: LanguageModel | null = null;
  private tools: ToolCollection = {};
  private systemPrompt: string = '';
  // Map of dynamic tool clients for closing connections
  private dynamicClients: Record<string, MCPClient> = {};

  // State Management
  setModel(model: LanguageModel): void {
    this.model = model;
  }
  
  setTools(tools: ToolCollection): void {
    this.tools = tools;
  }
  
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }
  
  reset(): void {
    this.model = null;
    this.tools = {};
    this.systemPrompt = '';
    this.dynamicClients = {};
  }

  // Tool Management
  async loadSelectedTools(selectedToolKeys?: string[]): Promise<ToolCollection> {
    const loadedTools: ToolCollection = {};
    this.dynamicClients = {}; // Reset dynamic clients

    if (!selectedToolKeys?.length) {
      console.log('No tool keys provided.');
      return loadedTools;
    }

    console.log('Attempting to load tools for keys:', selectedToolKeys);

    for (const key of selectedToolKeys) {
      // Try loading as a dynamic tool first
      const loader = DYNAMIC_TOOL_LOADERS[key];
      if (loader) {
        try {
          console.log(`Loading dynamic tool: ${key}`);
          const { tools: dynamicTools, client } = await loader();
          this.dynamicClients[key] = client; // Store the client for later cleanup
          Object.assign(loadedTools, dynamicTools); // Add loaded dynamic tools
          console.log(`${key} dynamic tools loaded:`, Object.keys(dynamicTools));
        } catch (error) {
          console.error(`Failed to load dynamic tool ${key}:`, error);
          // Decide if you want to continue loading other tools or throw/return error
        }
      } else {
        // If not dynamic, try loading as a static tool
        const staticTool = this.getToolByKey(key);
        if (staticTool) {
          console.log(`Loading static tool: ${key}`);
          // Use the key provided by the user for the tool in the collection
          loadedTools[key] = staticTool;
        } else if (key !== 'playwright' && key !== 'props') {
          // Log a warning if the key isn't dynamic, static, or a known pseudo-tool
           console.warn(`Tool key "${key}" not found in dynamic loaders or static registry (and is not 'playwright' or 'props').`);
        } else {
           // Acknowledge playwright/props keys even though they don't add tools directly here
           console.log(`Acknowledged pseudo-tool key: ${key}`);
        }
      }
    }

    console.log('Final tools loaded:', Object.keys(loadedTools));
    this.tools = loadedTools; // Update the manager's tools collection
    return loadedTools;
  }

  async closeClients(): Promise<void> {
    for (const [key, client] of Object.entries(this.dynamicClients)) {
      try {
        await client.close();
        console.log(`${key} client closed.`);
      } catch (error) {
        console.error(`Error closing ${key} client:`, error);
      }
    }
    this.dynamicClients = {};
  }

  // Model and Tool Access
  getModelByName(modelName: string): LanguageModel | null {
    if (!MODEL_CONFIG.AVAILABLE_MODELS.includes(modelName)) {
      console.warn(`Requested model "${modelName}" is not available.`);
      return null;
    }

    try {
      return MODEL_CONFIG.CLAUDE_MODELS.includes(modelName)
        ? createClaudeModel(modelName)
        : createModelViaProxy(modelName);
    } catch (error) {
      console.error(`Failed to create model "${modelName}":`, error);
      return null;
    }
  }

  getToolByKey(key: string): any {
    if (key === 'playwright' || key === 'props') return null;
    return toolRegistry[key as keyof typeof toolRegistry]?.tool || null;
  }

  getModelOptions(): Array<{ key: string; label: string }> {
    return MODEL_CONFIG.AVAILABLE_MODELS.map(name => ({
      key: name,
      label: name,
    }));
  }

  getToolOptions(): Array<{ key: string; label: string }> {
    return Object.entries(toolRegistry).map(([key, tool]) => ({
      key,
      label: tool.label,
    }));
  }

  getStaticTools(): ToolCollection {
    const staticTools: ToolCollection = {};
    Object.entries(toolRegistry).forEach(([key, tool]) => {
      if (key !== 'playwright' && key !== 'props' && tool.tool) {
        staticTools[key] = tool.tool;
      }
    });
    return staticTools;
  }

  // Execution
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
  }: CastOptions): Promise<any> {
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

  // Backward Compatibility
  async getPlaywrightTools(): Promise<ToolCollection> {
    const { tools: dynamicTools, client } = await DYNAMIC_TOOL_LOADERS.playwright();
    this.dynamicClients['playwright'] = client;
    return dynamicTools;
  }

  async getPropsTools(): Promise<ToolCollection> {
    const { tools: dynamicTools, client } = await DYNAMIC_TOOL_LOADERS.props();
    this.dynamicClients['props'] = client;
    return dynamicTools;
  }
}

// Exports
export const castingManager = new CastingManager();
export const tools = toolRegistry;
export { getPlaywrightTools, getPropsTools };
