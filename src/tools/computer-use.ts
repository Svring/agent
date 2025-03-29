import { anthropic } from '@ai-sdk/anthropic';
import { useServiceStore } from '@/store/service/serviceStore';
import { getEndpointUrl } from '@/models/service/serviceModel';
import { ScreenshotBase64Response } from '@/app/(app)/operator/types';

const operatorService = useServiceStore.getState().getService('operator');
const serviceOutput = useServiceStore.getState().serviceOutput;

// Function to get screen size - returns cached value or fetches new one
function getScreenSize() {
  // Get the last output from the screen size endpoint
  return serviceOutput['operator']['/screen_size'][-1].data;
}

// Renamed function to reflect base64 format
async function getScreenshotBase64(): Promise<string> {
  if (!operatorService) {
    throw new Error('Operator service is not active');
  }

  const screenshotEndpoint = operatorService.endpoints.find(
    endpoint => endpoint.path === '/screenshot_base64' && endpoint.method === 'POST'
  );

  if (!screenshotEndpoint) {
    throw new Error('Screenshot endpoint not found');
  }

  const requestBody = {
    format: 'png',
    full_screen: true
  };

  try {
    const response = await fetch(getEndpointUrl(operatorService, screenshotEndpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to get error details
      throw new Error(`Screenshot request failed with status: ${response.status}. ${errorData.detail || ''}`.trim());
    }

    const data = await response.json() as ScreenshotBase64Response;
    if (!data || typeof data.base64_image !== 'string' || typeof data.format !== 'string') {
        throw new Error('Invalid screenshot response format from API');
    }
    return `data:image/${data.format};base64,${data.base64_image}`;
  } catch (error: any) {
    console.error('Error capturing screenshot:', error);
    // Rethrow with a more specific message if possible
    throw new Error(`Failed to call screenshot endpoint: ${error.message}`);
  }
}

// New function dedicated to calling the screenshot endpoint
async function callScreenshotEndpoint(): Promise<string> {
  if (!operatorService) {
    throw new Error('Operator service is not active');
  }

  const screenshotEndpoint = operatorService.endpoints.find(
    endpoint => endpoint.path === '/screenshot_base64' && endpoint.method === 'POST'
  );

  if (!screenshotEndpoint) {
    throw new Error('Screenshot endpoint not found');
  }

  const requestBody = {
    format: 'png',
    full_screen: true
  };

  try {
    const response = await fetch(getEndpointUrl(operatorService, screenshotEndpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to get error details
      throw new Error(`Screenshot request failed with status: ${response.status}. ${errorData.detail || ''}`.trim());
    }

    const data = await response.json() as ScreenshotBase64Response;
    if (!data || typeof data.base64_image !== 'string' || typeof data.format !== 'string') {
        throw new Error('Invalid screenshot response format from API');
    }
    return `data:image/${data.format};base64,${data.base64_image}`;
  } catch (error: any) {
    console.error('Error capturing screenshot:', error);
    // Rethrow with a more specific message if possible
    throw new Error(`Failed to call screenshot endpoint: ${error.message}`);
  }
}

// Function to execute a computer action - now returns string or image object
async function executeComputerAction(action: string, coordinate: number[] | undefined, text: string | undefined): Promise<string | { type: 'image', data: string }> {
  console.log('executeComputerAction', action, 'coordinate', coordinate, 'text', text);

  // Handle screenshot action separately as it needs direct endpoint call and specific return type
  if (action === 'screenshot') {
    try {
      const base64DataUrl = await callScreenshotEndpoint();
      return {
        type: 'image',
        data: base64DataUrl,
      };
    } catch (error: any) {
        console.error(`Error executing action '${action}':`, error);
        throw new Error(`Failed to execute action '${action}': ${error.message}`);
    }
  }

  // Logic for other actions that call the operator service
  if (!operatorService) {
    throw new Error('Operator service is not active');
  }

  let endpointPath: string;
  let method: string = 'POST'; // Default to POST
  let requestBody: object | null = null;

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
      if (!coordinate || coordinate.length !== 2) throw new Error(`Valid 'coordinate' [x, y] is required for action: ${action}`);
      requestBody = { x: coordinate[0], y: coordinate[1], button: action.split('_')[0] }; // Extract 'left', 'right', or 'middle'
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
      // Throw an error for unhandled actions to make issues explicit
      throw new Error(`Action '${action}' is unknown or not handled.`);
  }

  const endpoint = operatorService.endpoints.find(ep => ep.path === endpointPath && ep.method === method);
  if (!endpoint) {
    throw new Error(`Endpoint not found for action: ${action} (${method} ${endpointPath})`);
  }

  try {
    const response = await fetch(getEndpointUrl(operatorService, endpoint), {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody ? JSON.stringify(requestBody) : null,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(`Action '${action}' failed: ${result.detail || result.message || response.statusText}`);
    }

    if (action === 'cursor_position') {
        return `Current cursor position: (${result.x}, ${result.y})`;
    }

    // Return the success message from the API
    return result.message || `Action '${action}' executed successfully.`;
  } catch (error: any) {
    console.error(`Error executing action '${action}':`, error);
    throw new Error(`Failed to execute action '${action}': ${error.message}`);
  }
}

// Tool definition
export const computerUseTool = anthropic.tools.computer_20241022({
  displayWidthPx: getScreenSize().width,
  displayHeightPx: getScreenSize().height,
  execute: async ({ action, coordinate, text }) => {
    // All actions are now handled by executeComputerAction, which returns string or image object
    return await executeComputerAction(action, coordinate, text);
  },
  experimental_toToolResultContent(result) {
    return typeof result === 'string'
      ? [{ type: 'text', text: result }]
      : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
  },
});