import { anthropic } from "@ai-sdk/anthropic";
import fs from 'fs/promises';
import path from 'path';
import * as toml from '@iarna/toml';

interface ServiceConfig {
  name: string;
  port: number;
  base_url: string;
  route_url?: string;
  icon?: string;
  folder_path?: string;
  init_command?: string;
  status?: string;
  endpoints?: any[];
}

interface FileEditorResponse {
  success: boolean;
  content?: string;
  message?: string;
  error?: string;
  file_path?: string;
}

let operatorConfigCache: ServiceConfig | null | undefined = undefined;

// Function to read and parse the service config TOML file
async function getOperatorConfig(): Promise<ServiceConfig | null> {
  if (operatorConfigCache !== undefined) {
    return operatorConfigCache;
  }
  
  try {
    const configPath = path.join(process.cwd(), 'src', 'config', 'serviceConfig.toml');
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const fullConfig = toml.parse(fileContent);

    if (typeof fullConfig === 'object' && fullConfig !== null && 'services' in fullConfig) {
      const services = fullConfig.services as any;
      if (typeof services === 'object' && services !== null && 'operator' in services) {
        operatorConfigCache = services.operator as ServiceConfig;
        return operatorConfigCache;
      }
    }
    console.error('Operator configuration structure invalid within serviceConfig.toml');
    operatorConfigCache = null;
    return null;
  } catch (error: any) {
    console.error('Failed during TOML load/parse:', error.message || error);
    operatorConfigCache = null;
    return null;
  }
}

async function executeTextEditorFunction({
  command,
  path,
  fileText,
  insertLine,
  newStr,
  oldStr,
  viewRange
}: {
  command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
  path: string;
  fileText?: string;
  insertLine?: number;
  newStr?: string;
  oldStr?: string;
  viewRange?: number[];
}): Promise<string> {
  try {
    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
      throw new Error('Operator service configuration could not be loaded.');
    }

    const endpointPath = '/edit_file';
    const method = 'POST';
    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    
    console.log(`Executing text editor command: ${command} on path: ${path}`);
    
    const requestBody = {
      command,
      path,
      file_text: fileText,
      insert_line: insertLine,
      new_str: newStr,
      old_str: oldStr,
      view_range: viewRange
    };

    const response = await fetch(requestUrl, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Text editor operation failed: ${response.status} ${response.statusText}. ${errorText}`.trim());
    }

    const result = await response.json() as FileEditorResponse;
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred during text editor operation');
    }

    if (command === 'view' && result.content) {
      return result.content;
    } else {
      return result.message || `Operation ${command} completed successfully`;
    }
  } catch (error: any) {
    console.error('Error during text editor operation:', error.message || error);
    throw new Error(`Failed to execute text editor operation: ${error.message}`);
  }
}

export const textEditorTool = anthropic.tools.textEditor_20241022({
  execute: async ({
    command,
    path,
    file_text,
    insert_line,
    new_str,
    old_str,
    view_range
  }) => {
    return executeTextEditorFunction({
      command,
      path,
      fileText: file_text,
      insertLine: insert_line,
      newStr: new_str,
      oldStr: old_str,
      viewRange: view_range
    });
  }
});