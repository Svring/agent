import { anthropic } from '@ai-sdk/anthropic';

// Node.js imports for reading config file (will only work server-side)
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

interface CommandResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  return_code: number;
}

let operatorConfigCache: ServiceConfig | null | undefined = undefined; // Cache: undefined = not loaded, null = load failed/not found

// Function to read and parse the service config TOML file
async function getOperatorConfig(): Promise<ServiceConfig | null> {
  if (operatorConfigCache !== undefined) {
    return operatorConfigCache;
  }

  try {
    const configPath = path.join(process.cwd(), 'src', 'config', 'serviceConfig.toml');
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const fullConfig = toml.parse(fileContent);

    // Check if services and operator exist in the parsed config
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

// Function to execute a bash command via the operator service
async function executeCommand(command: string, timeout: number = 30): Promise<CommandResponse> {
  console.log(`Executing bash command: ${command} (timeout: ${timeout}s)`);

  try {
    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
      throw new Error('Operator service configuration could not be loaded.');
    }

    const endpointPath = '/execute_command';
    const method = 'POST';
    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;

    const requestBody = {
      command: command,
      timeout: timeout
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
      throw new Error(`Command execution failed: ${response.status} ${response.statusText}. ${errorText}`.trim());
    }

    const result = await response.json() as CommandResponse;

    if (result.success === false) {
      throw new Error(`Command execution reported failure from API`);
    }

    return result;
  } catch (error: any) {
    console.error('Error during command execution:', error.message || error);
    throw new Error(`Failed to execute command: ${error.message}`);
  }
}

// Format the command output to be displayed to the user
function formatCommandOutput(result: CommandResponse): string {
  let output = '';

  // Add return code information
  output += `Exit Code: ${result.return_code}\n\n`;

  // Add stdout if it exists
  if (result.stdout && result.stdout.trim() !== '') {
    output += `STDOUT:\n${result.stdout.trim()}\n\n`;
  }

  // Add stderr if it exists
  if (result.stderr && result.stderr.trim() !== '') {
    output += `STDERR:\n${result.stderr.trim()}\n\n`;
  }

  return output.trim();
}

// Tool definition
export const bashTool = anthropic.tools.bash_20250124({
  execute: async ({ command, restart = false }) => {
    try {
      // Execute the command via the operator service
      // Ignore the restart parameter as it's not applicable in our implementation
      const timeout = 30; // Default timeout
      const result = await executeCommand(command, timeout);

      // Return the command result object directly
      return result;
    } catch (error: any) {
      throw error;
    }
  },
  experimental_toToolResultContent(result: CommandResponse) {
    const formattedOutput = formatCommandOutput(result);
    return [{ type: 'text', text: formattedOutput }];
  }
}); 