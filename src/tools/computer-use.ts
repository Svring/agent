import { anthropic } from '@ai-sdk/anthropic';
import { useServiceStore } from '@/store/service/serviceStore';
import { getEndpointUrl } from '@/models/service/serviceModel';

interface ScreenshotBase64Response {
  success: boolean;
  format: string;
  base64_image: string;
  is_full_screen: boolean;
}

const operatorService = useServiceStore.getState().getService('operator');
const serviceOutput = useServiceStore.getState().serviceOutput;

// Function to get screen size - returns cached value or fetches new one
function getScreenSize() {
  return serviceOutput['operator']['/screen_size'];
}

async function getScreenshot() {
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
      throw new Error(`Screenshot request failed with status: ${response.status}`);
    }

    const data = await response.json() as ScreenshotBase64Response;
    return `data:image/${data.format};base64,${data.base64_image}`;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
}

function executeComputerAction(action: string, coordinate: number[] | undefined, text: string | undefined) {
  return 'executeComputerAction';
}

export const computerUseTool = anthropic.tools.computer_20241022({
  displayWidthPx: getScreenSize()[-1].data.width,
  displayHeightPx: getScreenSize()[-1].data.height,
  execute: async ({ action, coordinate, text }) => {
    // Refresh screen size before taking a screenshot
    if (action === 'screenshot') {      
      const screenshot = await getScreenshot();
      return {
        type: 'image',
        data: screenshot,
      };
    }
    
    return executeComputerAction(action, coordinate, text);
  },
  experimental_toToolResultContent(result) {
    return typeof result === 'string'
      ? [{ type: 'text', text: result }]
      : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
  },
});