// Central registry for models and tools
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel, streamText } from 'ai';

// Import tools
import { computerTool } from '@/tools/functions/computer';
import { browserTools } from '@/tools/functions/browser';
import { terminalTools } from '@/tools/functions/terminal';

// Types
type ToolRegistry = Record<string, { label: string; tool: any }>;
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

// Tool categories and their associated tools
const toolRegistry: ToolRegistry = {
  computer: { label: 'Computer Use', tool: computerTool },
  browser: { label: 'Browser Control', tool: browserTools },
  terminal: { label: 'Terminal Commands', tool: terminalTools },
};

// Pre-populated tool groups mapping
const TOOL_GROUPS: Record<string, string[]> = {
  computer: typeof computerTool === 'function' ? ['computer'] : Object.keys(computerTool),
  browser: Object.keys(browserTools),
  terminal: Object.keys(terminalTools),
};

// Flattened tool registry with all individual tools
const staticToolRegistry: ToolCollection = {
  ...(typeof computerTool === 'function' ? { computer: computerTool } : computerTool),
  ...browserTools,
  ...terminalTools,
};

interface UserCastingConfig {
  model: LanguageModel | null;
  tools: ToolCollection; 
  systemPrompt: string;
  selectedToolKeys: string[]; // Can be category keys or individual tool keys
}

// Model Creation Helpers
const createModelViaProxy = (modelName: string): LanguageModel => {
  const baseURL = process.env.SEALOS_USW_BASE_URL;
  console.log(`Creating model "${modelName}" via proxy URL: ${baseURL}`);
  
  const openai = createOpenAI({ 
    baseURL, 
    apiKey: process.env.SEALOS_USW_API_KEY,
    compatibility: 'compatible'
  }); 
  return openai(modelName);
};

const createClaudeModel = (modelName: string): LanguageModel => {
  console.log(`Creating Claude model "${modelName}" via Anthropic SDK`);
  const anthropic = createAnthropic({
    apiKey: process.env.SEALOS_USW_API_KEY,
    baseURL: process.env.SEALOS_USW_BASE_URL,
  });
  return anthropic(modelName);
};

// Cast method parameter interface
interface CastOptions {
  userId: string;
  model?: LanguageModel;
  modelName?: string;
  toolKeys?: string[];
  systemPrompt?: string;
  messages: any;
  maxSteps?: number;
  toolCallStreaming?: boolean;
  onToolCall?: (event: { tool: string; args: any }) => void;
  onToolResult?: (event: { tool: string; result: any }) => void;
  onError?: (event: { error: unknown }) => void;
  onFinish?: (result: any) => void;
  [key: string]: any;
}

/**
 * Manages models, tools, system prompt, and other state for casting tasks.
 */
export class CastingManager {
  private static instance: CastingManager;
  private userConfigs: Map<string, UserCastingConfig> = new Map();

  private constructor() {}

  public static getInstance(): CastingManager {
    if (!CastingManager.instance) {
      CastingManager.instance = new CastingManager();
    }
    return CastingManager.instance;
  }

  private getUserConfig(userId: string): UserCastingConfig {
    if (!this.userConfigs.has(userId)) {
      this.userConfigs.set(userId, {
        model: null,
        tools: {},
        systemPrompt: '',
        selectedToolKeys: [],
      });
    }
    return this.userConfigs.get(userId)!;
  }
  
  public async initializeUserSession(userId: string, modelName?: string, toolKeys?: string[], systemPrompt?: string): Promise<void> {
    if (!userId) throw new Error("User ID is required");
    const config = this.getUserConfig(userId);
    
    if (modelName) {
      config.model = this.getModelByName(modelName);
    }
    
    if (systemPrompt) {
      config.systemPrompt = systemPrompt;
    }
    
    if (toolKeys) {
      await this.setToolsForUser(userId, toolKeys);
    }
  }
  
  public async setModelForUser(userId: string, modelName: string): Promise<void> {
    if (!userId || !modelName) throw new Error("User ID and model name are required");
    const config = this.getUserConfig(userId);
    config.model = this.getModelByName(modelName);
  }

  // Expanded to handle both category keys and individual tool keys
  public async setToolsForUser(userId: string, selectedKeys: string[]): Promise<void> {
    if (!userId) throw new Error("User ID is required");
    const config = this.getUserConfig(userId);
    config.selectedToolKeys = selectedKeys;
    
    // Reset tools collection
    config.tools = {};
    
    // Process each selected key
    for (const key of selectedKeys) {
      // If it's a tool category key (computer, browser, terminal)
      if (TOOL_GROUPS[key]) {
        // Add all tools from this category
        for (const toolKey of TOOL_GROUPS[key]) {
          if (staticToolRegistry[toolKey]) {
            config.tools[toolKey] = staticToolRegistry[toolKey];
          }
        }
      } 
      // If it's an individual tool key
      else if (staticToolRegistry[key]) {
        config.tools[key] = staticToolRegistry[key];
      }
    }
  }

  public setSystemPromptForUser(userId: string, prompt: string): void {
    if (!userId) throw new Error("User ID is required");
    this.getUserConfig(userId).systemPrompt = prompt;
  }

  public async resetUserConfig(userId: string): Promise<void> {
    if (!userId) throw new Error("User ID is required");
    this.userConfigs.delete(userId);
  }

  // Returns model options for UI selection
  public getModelOptions(): Array<{ key: string; label: string }> {
    return MODEL_CONFIG.AVAILABLE_MODELS.map(name => ({ key: name, label: name }));
  }

  // Returns tool categories for UI selection
  public getToolOptions(): Array<{ key: string; label: string }> {
    return Object.entries(toolRegistry).map(([key, value]) => ({
      key,
      label: value.label
    }));
  }

  // Helper to get a model instance by name
  public getModelByName(modelName: string): LanguageModel | null {
    if (!MODEL_CONFIG.AVAILABLE_MODELS.includes(modelName)) {
      console.warn(`Model ${modelName} is not available`);
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

  public async cast(options: CastOptions): Promise<any> {
    const { 
      userId, modelName, toolKeys, systemPrompt,
      messages, maxSteps = 20, toolCallStreaming = true,
      onToolCall, onToolResult, onError, onFinish, ...rest 
    } = options;

    if (!userId) throw new Error("User ID is required for cast operation");
    const config = this.getUserConfig(userId);

    // Update configuration if needed
    if (modelName && (!config.model || config.model.modelId !== modelName)) {
      await this.setModelForUser(userId, modelName);
    }
    
    if (toolKeys) {
      await this.setToolsForUser(userId, toolKeys);
    }
    
    if (systemPrompt && systemPrompt !== config.systemPrompt) {
      this.setSystemPromptForUser(userId, systemPrompt);
    }

    if (!config.model) {
      const error = new Error(`No model configured for user ${userId}`);
      if (onError) onError({ error });
      throw error; 
    }

    // Stream the response
    const streamOptions: any = {
      model: config.model,
      system: config.systemPrompt,
      messages,
      tools: config.tools,
      maxSteps,
      toolCallStreaming,
      onError: async (event: any) => { if (onError) onError(event); },
      onFinish: async (result: any) => { if (onFinish) await onFinish(result); },
      ...rest,
    };
    
    // Add tool events if provided
    if (onToolCall) streamOptions.onToolCall = onToolCall;
    if (onToolResult) streamOptions.onToolResult = onToolResult;
    
    return streamText(streamOptions);
  }
}

export const castingManager = CastingManager.getInstance();
export const staticTools = staticToolRegistry;
export const toolCategories = Object.keys(toolRegistry);

