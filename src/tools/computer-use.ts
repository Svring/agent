import { anthropic } from '@ai-sdk/anthropic';
import { ScreenshotBase64Response, ScreenSizeResponse } from '@/app/(app)/operator/types';

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
  status?: string; // Keep status for context if needed, but won't be live
  endpoints?: any[]; // Simplified endpoint structure from TOML
}

let operatorConfigCache: ServiceConfig | null | undefined = undefined; // Cache: undefined = not loaded, null = load failed/not found
let screenSizeCache: { width: number; height: number } | null = null; // Cache for screen size

// Function to read and parse the service config TOML file
// This will only work reliably in a Node.js environment (like API routes)
async function getOperatorConfig(): Promise<ServiceConfig | null> {
  if (operatorConfigCache !== undefined) {
    return operatorConfigCache;
  }
  // console.log("Attempting to load operator config from TOML..."); // Less verbose now
  try {
    const configPath = path.join(process.cwd(), 'src', 'config', 'serviceConfig.toml');
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const fullConfig = toml.parse(fileContent);

    // Check if services and operator exist in the parsed config
    if (typeof fullConfig === 'object' && fullConfig !== null && 'services' in fullConfig) {
      const services = fullConfig.services as any;
      if (typeof services === 'object' && services !== null && 'operator' in services) {
        // Basic validation might be added here if needed
        operatorConfigCache = services.operator as ServiceConfig;
        // console.log("Successfully loaded operator config from TOML:", operatorConfigCache?.name); // Less verbose now
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

// New function to fetch screen size from the operator service
async function fetchScreenSize(): Promise<{ width: number; height: number } | null> {
  // console.log("Attempting to fetch screen size..."); // Less verbose now
  if (screenSizeCache) {
    // console.log("Returning cached screen size:", screenSizeCache); // Less verbose now
    return screenSizeCache;
  }
  try { // Wrap core logic
    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
      console.error("Cannot fetch screen size: Operator config not loaded.");
      return null;
    }

    const endpointPath = '/screen_size';
    const method = 'GET';
    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    // console.log(`Fetching screen size from ${method} ${requestUrl}`); // Less verbose now

    const response = await fetch(requestUrl, { method: method });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Screen size request failed: ${response.status} ${response.statusText}. ${errorText}`.trim());
    }

    const data = await response.json() as ScreenSizeResponse;

    if (typeof data.width !== 'number' || typeof data.height !== 'number') {
      throw new Error('Invalid screen size response format from API');
    }

    console.log(`Fetched screen size: ${data.width}x${data.height}`);
    screenSizeCache = { width: data.width, height: data.height };
    return screenSizeCache;
  } catch (error: any) {
    console.error('Error during fetchScreenSize execution:', error.message || error);
    return null;
  }
}

// Define the structure returned by callScreenshotEndpoint
interface ScreenshotResult {
  format: string;
  base64_image: string;
}

// New function dedicated to calling the screenshot endpoint
// Now returns an object with format and raw base64 data
async function callScreenshotEndpoint(): Promise<ScreenshotResult> {
  // console.log("Attempting to call screenshot endpoint..."); // Less verbose now
  try { // Wrap core logic
    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
      throw new Error('Operator service configuration could not be loaded.');
    }

    const endpointPath = '/screenshot_base64';
    const method = 'POST';
    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    // console.log(`Calling ${method} ${requestUrl}`); // Less verbose now

    const requestBody = {
      format: 'png',
      full_screen: true
    };

    const response = await fetch(requestUrl, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Screenshot request failed: ${response.status} ${response.statusText}. ${errorData.detail || ''}`.trim());
    }

    const data = await response.json() as ScreenshotBase64Response;
    if (data.success === false) {
      throw new Error(`Screenshot request reported failure (success: false)`);
    }
    // Ensure expected fields are present
    if (!data || typeof data.base64_image !== 'string' || typeof data.format !== 'string') {
      throw new Error('Invalid screenshot response format from API');
    }
    // console.log("Screenshot endpoint called successfully."); // Less verbose now
    // Return the object with format and raw base64
    return {
      format: data.format,
      base64_image: data.base64_image
    };
  } catch (error: any) {
    console.error('Error during callScreenshotEndpoint execution:', error.message || error);
    throw new Error(`Failed to call screenshot endpoint: ${error.message}`);
  }
}

// Define the type for the return value when it's an image action
interface ImageActionResult {
  type: 'image';
  format: string; // e.g., 'png', 'jpeg'
  data: string; // Raw base64 data
}

// Update the return type union for executeComputerAction
type ComputerActionResult = string | ImageActionResult;

// Function to execute a computer action
async function executeComputerAction(action: string, coordinate: number[] | undefined, text: string | undefined): Promise<ComputerActionResult> {
  console.log(`Executing action '${action}'...`); // Simplified entry log
  try { // Wrap the entire function logic
    if (action === 'screenshot') {
      try {
        const screenshotResult = await callScreenshotEndpoint();
        return {
          type: 'image',
          format: screenshotResult.format,
          data: screenshotResult.base64_image,
        };
      } catch (screenshotError: any) {
        // Log specifically for screenshot action failure
        console.error(`Screenshot action failed within executeComputerAction: ${screenshotError.message}`);
        throw screenshotError;
      }
    }

    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
      throw new Error('Operator service configuration could not be loaded during action execution.');
    }

    let endpointPath: string;
    let method: string = 'POST';
    let requestBody: object | null = null;

    // Switch statement remains the same...
    switch (action) {
      case 'key':
        endpointPath = '/press_key';
        if (!text) throw new Error(`'text' is required for action: ${action}`);
        requestBody = { key: text };
        break;
      case 'type':
        endpointPath = '/type_text';
        if (!text) throw new Error(`'text' is required for action: ${action}`);
        requestBody = { text: text };
        break;
      case 'mouse_move':
        endpointPath = '/move';
        if (!coordinate || coordinate.length !== 2) throw new Error(`Valid 'coordinate' [x, y] is required for action: ${action}`);
        requestBody = { x: coordinate[0], y: coordinate[1] };
        break;
      case 'left_click':
      case 'right_click':
      case 'middle_click':
        endpointPath = '/click';
        // Coordinates are now optional for clicks
        requestBody = {
          button: action.split('_')[0] // Extract 'left', 'right', or 'middle'
        };
        if (coordinate) { // Only add coordinates if provided
          if (coordinate.length !== 2) {
            throw new Error(`If provided, 'coordinate' [x, y] must have 2 elements for action: ${action}`);
          }
          requestBody = { ...requestBody, x: coordinate[0], y: coordinate[1] };
        }
        break;
      case 'left_click_drag':
        endpointPath = '/drag';
        if (!coordinate || coordinate.length !== 2) throw new Error(`Valid 'coordinate' [x, y] is required for action: ${action}`);
        requestBody = { x: coordinate[0], y: coordinate[1], button: 'left' };
        break;
      case 'double_click':
        endpointPath = '/double_click';
        if (coordinate && coordinate.length === 2) {
          requestBody = { x: coordinate[0], y: coordinate[1], button: 'left' };
        } else {
          requestBody = { button: 'left' }; // Click at current position if no coords provided
        }
        break;
      case 'cursor_position':
        endpointPath = '/cursor_position';
        method = 'GET'; // This is a GET request
        requestBody = null;
        break;
      default:
        console.warn(`Unknown or unhandled action received in executeComputerAction: ${action}`);
        throw new Error(`Action '${action}' is unknown or not handled.`);
    }


    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    // console.log(`Calling Operator Action: ${method} ${requestUrl}`); // Less verbose now

    const response = await fetch(requestUrl, {
      method: method,
      headers: {
        ...(requestBody && { 'Content-Type': 'application/json' }),
      },
      ...(requestBody && { body: JSON.stringify(requestBody) }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Action '${action}' failed HTTP request: ${response.status} ${response.statusText}. ${result?.detail || result?.message || ''}`.trim());
    }
    if (result.success === false) {
      throw new Error(`Action '${action}' reported failure by API: ${result.detail || result.message || 'Unknown API error'}`.trim());
    }

    console.log(`Action '${action}' executed successfully via API.`);

    if (action === 'cursor_position') {
      if (typeof result.x !== 'number' || typeof result.y !== 'number') {
        throw new Error(`Action '${action}' succeeded but returned invalid position data.`);
      }
      return `Current cursor position: (${result.x}, ${result.y})`;
    }

    // Return the success message (string) for non-screenshot actions
    return result.message || `Action '${action}' executed successfully.`;

  } catch (error: any) {
    console.error(`Error during executeComputerAction for action '${action}':`, error.message || error);
    throw error;
  }
}

// Tool definition
// NOTE: displayWidthPx and displayHeightPx are static placeholders below.
// The actual screen size can be fetched using the exported fetchScreenSize function
// if needed, but the tool definition itself requires static values here.
export const computerUseTool = anthropic.tools.computer_20241022({
  displayWidthPx: 1470, // Placeholder - Actual size fetched by fetchScreenSize()
  displayHeightPx: 956, // Placeholder - Actual size fetched by fetchScreenSize()
  execute: async ({ action, coordinate, text }) => {
    return await executeComputerAction(action, coordinate, text);
  },
  experimental_toToolResultContent(result: ComputerActionResult) {
    if (typeof result === 'string') {
      // Handle text result
      return [{ type: 'text', text: result }];
    } else if (result.type === 'image') {
      // Handle image result, using the format and raw base64 data
      return [{
        type: 'image',
        data: result.data, // Use the raw base64 data
        mimeType: `image/${result.format}` // Construct mimeType from format
      }];
    } else {
      // Fallback or error handling if needed
      return [{ type: 'text', text: 'Tool returned unexpected result format.' }];
    }
  },
});

// Export the fetch function separately if needed elsewhere
export { fetchScreenSize };