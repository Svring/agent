import { anthropic } from '@ai-sdk/anthropic';

function getScreenshot() {
  return 'screenshot';
}

function executeComputerAction(action: string, coordinate: number[] | undefined, text: string | undefined) {
  return 'executeComputerAction';
}

const computerTool = anthropic.tools.computer_20250124({
  displayWidthPx: 1024,
  displayHeightPx: 768,
  execute: async ({ action, coordinate, text }) => {
    switch (action) {
      case 'screenshot': {
        return {
          type: 'image',
          data: getScreenshot(),
        };
      }
      default: {
        return executeComputerAction(action, coordinate, text);
      }
    }
  },
  experimental_toToolResultContent(result) {
    return typeof result === 'string'
      ? [{ type: 'text', text: result }]
      : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
  },
});

export default computerTool;