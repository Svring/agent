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
  // console.log("Attempting to call screenshot endpoint...");
  try {
    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
      throw new Error('Operator service configuration could not be loaded.');
    }

    const endpointPath = '/screenshot_base64';
    const method = 'POST';
    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    // console.log(`Calling ${method} ${requestUrl}`);

    // IMPORTANT: The backend service at this endpoint MUST ensure the returned image
    // is exactly 1024x768 pixels, either by downscaling (for larger screens)
    // or by padding with black borders (for smaller screens).
    // Image processing libraries (e.g., Pillow for Python, sharp for Node.js)
    // should be used in the backend implementation.
    const requestBody = {
      format: 'png', // or 'jpeg' if preferred
      full_screen: true // Assuming the backend handles resizing/padding the full screen
      // Request specific size? Only if backend supports it AND handles it correctly:
      // width: 1024,
      // height: 768,
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
    if (!data || typeof data.base64_image !== 'string' || typeof data.format !== 'string') {
      throw new Error('Invalid screenshot response format from API (expected base64_image and format)');
    }

    // We *assume* the backend returned a 1024x768 image as requested by the comments above.
    // No resizing/padding is done here in the frontend tool code.
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
type ComputerActionResult = string | ImageActionResult | [ImageActionResult];

// Define the target dimensions expected by the Anthropic tool
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 768;

// Function to execute a computer action
async function executeComputerAction(
  action: string, 
  modelCoordinate: number[] | undefined, // Coordinate from the model (based on 1024x768)
  text: string | undefined
): Promise<ComputerActionResult> {
  console.log(`Executing action '${action}'...`);
  try {
    // Handle screenshot action first
    if (action === 'screenshot') {
      try {
        const screenshotResult = await callScreenshotEndpoint();
        // Return the (assumed) 1024x768 image directly
        return {
          type: 'image',
          format: screenshotResult.format,
          data: screenshotResult.base64_image,
        };
      } catch (screenshotError: any) {
        console.error(`Screenshot action failed: ${screenshotError.message}`);
        throw screenshotError;
      }
    }

    // For other actions, get config and potentially transform coordinates
    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
      throw new Error('Operator config not loaded for action execution.');
    }

    let transformedCoordinate: { x: number; y: number } | undefined = undefined;

    // Check if coordinate transformation is needed
    if (modelCoordinate && (
        action === 'mouse_move' || 
        action === 'left_click' || action === 'right_click' || action === 'middle_click' ||
        action === 'left_click_drag' || action === 'double_click'
      )) {
      
      if (modelCoordinate.length !== 2) {
          throw new Error(`Invalid coordinate provided by model for action ${action}: Expected [x, y]. Got: ${modelCoordinate}`);
      }

      const originalScreenSize = await fetchScreenSize();
      if (!originalScreenSize) {
        throw new Error('Failed to fetch original screen size for coordinate transformation.');
      }

      const originalWidth = originalScreenSize.width;
      const originalHeight = originalScreenSize.height;
      const [modelX, modelY] = modelCoordinate;

      let finalX: number;
      let finalY: number;

      // Determine if padding or scaling was likely applied by the backend
      if (originalWidth <= TARGET_WIDTH && originalHeight <= TARGET_HEIGHT) {
        // Padding was likely applied: Map from padded area back to original
        const offsetX = Math.max(0, (TARGET_WIDTH - originalWidth) / 2);
        const offsetY = Math.max(0, (TARGET_HEIGHT - originalHeight) / 2);
        finalX = modelX - offsetX;
        finalY = modelY - offsetY;
        console.log(`Coordinate Transformation (Padding): Model (${modelX}, ${modelY}) -> Original (${finalX}, ${finalY}) with offset (${offsetX}, ${offsetY})`);

      } else {
        // Downscaling was likely applied: Map from scaled back to original
        const scaleX = originalWidth / TARGET_WIDTH;
        const scaleY = originalHeight / TARGET_HEIGHT;
        finalX = modelX * scaleX;
        finalY = modelY * scaleY;
         console.log(`Coordinate Transformation (Scaling): Model (${modelX}, ${modelY}) -> Original (${finalX}, ${finalY}) with scale (${scaleX.toFixed(2)}, ${scaleY.toFixed(2)})`);
      }

       // Clamp coordinates to be within the original screen bounds and ensure they are integers
      finalX = Math.max(0, Math.min(originalWidth - 1, Math.round(finalX)));
      finalY = Math.max(0, Math.min(originalHeight - 1, Math.round(finalY)));

      transformedCoordinate = { x: finalX, y: finalY };
      console.log(`Final Transformed & Clamped Coordinate: (${transformedCoordinate.x}, ${transformedCoordinate.y})`);
    }

    let endpointPath: string;
    let method: string = 'POST';
    let requestBody: any | null = null; // Use 'any' for flexibility, handle specific types below

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
        if (!transformedCoordinate) throw new Error(`Transformed coordinate missing for action: ${action}`);
        requestBody = transformedCoordinate;
        break;
      case 'left_click':
      case 'right_click':
      case 'middle_click':
        endpointPath = '/click';
        requestBody = {
          button: action.split('_')[0] // Extract 'left', 'right', or 'middle'
        };
        if (transformedCoordinate) { // Add transformed coords if available (click at specific point)
           requestBody = { ...requestBody, ...transformedCoordinate };
        } // Otherwise, click happens at current cursor position (handled by backend)
        break;
      case 'left_click_drag':
        endpointPath = '/drag';
        if (!transformedCoordinate) throw new Error(`Transformed coordinate missing for action: ${action}`);
        requestBody = { ...transformedCoordinate, button: 'left' };
        break;
      case 'double_click':
        endpointPath = '/double_click';
        requestBody = { button: 'left' }; // Always left button
         if (transformedCoordinate) { // Add transformed coords if available
           requestBody = { ...requestBody, ...transformedCoordinate };
         } // Otherwise, double-click happens at current cursor position
        break;
      case 'cursor_position': // No transformation needed for GET requests
        endpointPath = '/cursor_position';
        method = 'GET';
        requestBody = null;
        break;
      default:
        console.warn(`Unknown action received: ${action}`);
        throw new Error(`Action '${action}' is unknown or not handled.`);
    }

    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    // console.log(`Calling Operator Action: ${method} ${requestUrl} with body:`, requestBody ? JSON.stringify(requestBody) : 'None');

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
    // Note: Some successful GET results (like cursor_position) might not have a 'success' field.
    // Check for explicit failure *only if* the field exists.
    if (result.hasOwnProperty('success') && result.success === false) {
       throw new Error(`Action '${action}' reported failure by API: ${result.detail || result.message || 'Unknown API error'}`.trim());
    }

    console.log(`Action '${action}' executed successfully via API.`);

    if (action === 'cursor_position') {
      if (typeof result.x !== 'number' || typeof result.y !== 'number') {
         throw new Error(`Action '${action}' succeeded but returned invalid position data.`);
      }
      // Return the *original* cursor position, not transformed.
      return `Current cursor position: (${result.x}, ${result.y})`;
    }

    // Return the success message (string) for non-screenshot actions
    return result.message || `Action '${action}' executed successfully.`;

  } catch (error: any) {
    console.error(`Error during executeComputerAction for action '${action}':`, error.message || error);
    // Re-throw the error to ensure it's propagated correctly
    throw error;
  }
}

// Tool definition
export const computerUseTool = anthropic.tools.computer_20241022({
  // Set display dimensions to the target XGA resolution the model interacts with
  displayWidthPx: TARGET_WIDTH,  // Should be 1024
  displayHeightPx: TARGET_HEIGHT, // Should be 768
  execute: async ({ action, coordinate, text }) => {
    // Pass the model's coordinate directly, transformation happens inside executeComputerAction
    return await executeComputerAction(action, coordinate, text);
  },
  experimental_toToolResultContent(result: ComputerActionResult) {
    if (typeof result === 'string') {
      return [{ type: 'text', text: result }];
    } else if (Array.isArray(result)) {
      // Handle the [ImageActionResult] case
      if (result.length === 1 && result[0].type === 'image') {
        const imageResult = result[0];
        return [{
          type: 'image',
          data: imageResult.data,
          mimeType: `image/${imageResult.format}`
        }];
      } else {
        // Handle unexpected array formats
        console.error('Tool returned unexpected array format:', result);
        return [{ type: 'text', text: 'Tool returned unexpected array format.' }];
      }
    } else if (result.type === 'image') {
      // Handle the single ImageActionResult case
      // We assume the image data received from executeComputerAction is already 1024x768
      return [{
        type: 'image',
        data: result.data,
        mimeType: `image/${result.format}`
      }];
    } else {
      // Handle other unexpected formats
      console.error('Tool returned unexpected result format:', result);
      return [{ type: 'text', text: 'Tool returned unexpected result format.' }];
    }
  },
});

// Export the fetch function separately if needed elsewhere
export { fetchScreenSize };