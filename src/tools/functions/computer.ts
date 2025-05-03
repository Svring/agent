import { anthropic } from '@ai-sdk/anthropic';
// Import the PlaywrightManager to use its static method
import { PlaywrightManager } from '@/backstage/playwright-manager';

// Define the type for the return value when it's an image action
interface ImageActionResult {
  type: 'image';
  data: string; // Raw base64 data
  mimeType: string; // e.g., 'image/png'
}

// Update the return type union for the execute function
type ComputerToolResult = string | ImageActionResult;


// --- Tool Definition ---
// Assuming the tool interface expects viewport-relative coordinates directly
// and displayWidthPx/displayHeightPx are for model context only.

const computerTool = anthropic.tools.computer_20250124({
  displayWidthPx: 1024, // Informational for the model
  displayHeightPx: 768,  // Informational for the model
  execute: async ({ action, coordinate, text }): Promise<ComputerToolResult> => {
    console.log(`Computer Tool executing action: ${action}`, { coordinate, text });

    try {
      // No separate API response interface needed here now
      // let response: PlaywrightApiResponse;
      const params: Record<string, any> = {};

      // Extract coordinates if provided
      if (coordinate && coordinate.length === 2) {
        params.x = coordinate[0];
        params.y = coordinate[1];
      } else if (coordinate) {
         console.warn(`Received invalid coordinate format for action ${action}: ${coordinate}`);
         // Ignore invalid coordinate format but proceed if possible (e.g., for type/key)
      }

      // Map tool actions to Playwright API actions
      switch (action) {
        case 'screenshot':
          // Use the static method from PlaywrightManager
          const screenshotResponse = await PlaywrightManager.executeApiAction('screenshot');
          if (screenshotResponse.success && screenshotResponse.data && screenshotResponse.mimeType) {
            return {
              type: 'image',
              data: screenshotResponse.data,
              mimeType: screenshotResponse.mimeType,
            };
          } else {
            throw new Error(`Screenshot action failed or returned invalid data: ${screenshotResponse.message || 'Unknown API error'}`);
          }

        case 'key':
          if (!text) throw new Error(`'text' (containing the key name) is required for action: ${action}`);
          params.key = text;
          // Use the static method from PlaywrightManager
          const keyResponse = await PlaywrightManager.executeApiAction('pressKey', params);
          return keyResponse.message || `Key '${text}' pressed successfully.`;

        case 'type':
          if (text === undefined) throw new Error(`'text' parameter is required for action: ${action}`);
          params.text = text;
           // Use the static method from PlaywrightManager
          const typeResponse = await PlaywrightManager.executeApiAction('typeText', params);
          return typeResponse.message || `Text typed successfully.`;

        case 'mouse_move':
          if (params.x === undefined || params.y === undefined) throw new Error(`'coordinate' parameter [x, y] is required for action: ${action}`);
           // Use the static method from PlaywrightManager
          const moveResponse = await PlaywrightManager.executeApiAction('mouseMove', params);
          return moveResponse.message || `Mouse moved to (${params.x}, ${params.y}).`;

        case 'left_click':
        case 'right_click':
        case 'middle_click': {
          if (params.x === undefined || params.y === undefined) throw new Error(`'coordinate' parameter [x, y] is required for action: ${action}`);
          const button = action.split('_')[0] as 'left' | 'right' | 'middle';
          params.button = button;
          // Use the static method from PlaywrightManager
          const clickResponse = await PlaywrightManager.executeApiAction('click', params);
          return clickResponse.message || `${action} performed at (${params.x}, ${params.y}).`;
        }
        case 'double_click': {
           if (params.x === undefined || params.y === undefined) throw new Error(`'coordinate' parameter [x, y] is required for action: ${action}`);
           params.button = 'left';
           // Use the static method from PlaywrightManager
           const dblClickResponse = await PlaywrightManager.executeApiAction('doubleClick', params);
           return dblClickResponse.message || `${action} performed at (${params.x}, ${params.y}).`;
        }
        case 'left_mouse_down': {
           if (params.x === undefined || params.y === undefined) throw new Error(`'coordinate' parameter [x, y] is required for action: ${action}`);
           params.button = 'left';
           // Use the static method from PlaywrightManager
           const downResponse = await PlaywrightManager.executeApiAction('mouseDown', params);
           return downResponse.message || `Left mouse down at (${params.x}, ${params.y}).`;
        }
        case 'left_mouse_up': {
           if (params.x === undefined || params.y === undefined) throw new Error(`'coordinate' parameter [x, y] is required for action: ${action}`);
           params.button = 'left';
           // Use the static method from PlaywrightManager
           const upResponse = await PlaywrightManager.executeApiAction('mouseUp', params);
           return upResponse.message || `Left mouse up at (${params.x}, ${params.y}).`;
        }
        case 'left_click_drag': {
             if (params.x === undefined || params.y === undefined) throw new Error(`Start 'coordinate' parameter [x, y] is required for action: ${action}`);
             console.warn(`Action '${action}' requires start and end coordinates. Only start coordinate provided. Cannot execute drag via Playwright API.`);
             // If endCoordinate was available, would call: PlaywrightManager.executeApiAction('drag', params);
             return `Action '${action}' cannot be fully executed: End coordinate information missing from tool input.`;
        }
        case 'scroll':
          console.warn(`Action '${action}' might require clarification on parameters (deltaX/deltaY) from the tool schema.`);
          // If deltaX/Y were available, would call: PlaywrightManager.executeApiAction('scroll', params);
          return `Action '${action}' is not fully implemented due to unclear parameters (deltaX/deltaY).`;

        // Actions from schema not directly supported by Playwright API route:
        case 'cursor_position':
        case 'hold_key':
        case 'triple_click':
        case 'wait':
            console.warn(`Action '${action}' is not currently implemented or supported via the Playwright API route.`);
            return `Action '${action}' is not supported.`;

        default:
          console.warn(`Unknown or unhandled action received: ${action}`);
          throw new Error(`Action '${action}' is unknown or not handled.`);
      }
    } catch (error: any) {
      console.error(`Error executing computer tool action '${action}':`, error);
      // Return the error message as text feedback, adding context
      return `Error during '${action}': ${error.message}`;
    }
  },
  experimental_toToolResultContent(result: ComputerToolResult) {
    // Handle both string (text) and image results
    if (typeof result === 'string') {
      return [{ type: 'text', text: result }];
    } else if (result.type === 'image') {
      return [{
        type: 'image',
        data: result.data,
        mimeType: result.mimeType || 'image/png', // Default mime type if somehow missing
      }];
    } else {
      // Handle unexpected formats gracefully
      console.error('Tool returned unexpected result format:', result);
      const fallbackText = `Tool returned an unexpected result format: ${JSON.stringify(result)}`;
      return [{ type: 'text', text: fallbackText }];
    }
  },
});

// Export the tool if it needs to be used elsewhere
export { computerTool };