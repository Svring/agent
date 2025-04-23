import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from 'node-fetch';

// API endpoint for Playwright service
const PLAYWRIGHT_API_URL = 'http://localhost:3000/api/playwright';

// Helper function to check API response and provide specific error message
async function checkApiResponse(response, actionName) {
  if (!response.ok) {
    let errorMessage = `Failed to ${actionName}`;
    try {
      const errorBody = await response.json();
      errorMessage += `: ${errorBody.message || 'Unknown API error'}`;
      // Specifically check for browser not initialized error message
      if (errorBody.message && errorBody.message.includes('Browser not initialized')) {
        errorMessage = 'Browser not initialized. Please initialize the browser first.';
      }
    } catch (e) {
      // If parsing fails, use the status text
      errorMessage += `: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }
  return response; // Return the response if okay
}

// Helper function to optionally take a screenshot after an action
async function takeScreenshotIfRequested(screenshotAfter = true, fullPage = true) {
  if (!screenshotAfter) {
    return null; // Indicate no screenshot was taken
  }
  const screenshotResponse = await fetch(PLAYWRIGHT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'screenshot',
      options: { fullPage }
    })
  });
  await checkApiResponse(screenshotResponse, 'take screenshot after action');
  const screenshotResult = await screenshotResponse.json();
  return {
    type: "image",
    data: screenshotResult.data,
    mimeType: "image/png"
  };
}

// Create an MCP server
const server = new McpServer({
  name: "Playwright",
  version: "1.0.0",
  description: "A tool for interacting with web pages using Playwright. Assumes browser is already initialized and page is loaded."
});

// --- Screenshot Tool --- 
server.tool(
  "playwright_screenshot",
  {
    fullPage: z.boolean().optional().describe("Whether to capture the full scrollable page.")
  },
  async ({ fullPage = true }) => {
    try {
      console.log(`[PlaywrightMCP] Taking screenshot of current page.`);
      
      const screenshotResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'screenshot',
          options: { fullPage }
        })
      });
      await checkApiResponse(screenshotResponse, 'take screenshot');
      
      const screenshotResult = await screenshotResponse.json();
      
      return {
        type: "image",
        data: screenshotResult.data,
        mimeType: "image/png"
      };
    } catch (err) {
      console.error('[PlaywrightMCP] Screenshot Error:', err);
      return {
        type: "text",
        text: `Error: ${err.message}` 
      };
    }
  }
);

// --- Mouse Action Tool (Click, DoubleClick, RightClick) --- 
server.tool(
  "playwright_mouse_action",
  {
    action: z.enum(["click", "doubleClick", "rightClick"]).describe("The type of click action to perform."),
    x: z.number().describe("The x-coordinate (viewport relative).)"),
    y: z.number().describe("The y-coordinate (viewport relative).)"),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ action, x, y, screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Performing ${action} at (${x},${y}) on current page`);
                  
      let apiAction;
      let button = 'left';
      
      switch (action) {
        case "click":
          apiAction = 'click';
          break;
        case "doubleClick":
          apiAction = 'doubleClick';
          break;
        case "rightClick":
          apiAction = 'click';
          button = 'right';
          break;
        // Default should not be reachable due to z.enum
      }
      
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: apiAction,
          x: x,
          y: y,
          button: button
        })
      });
      await checkApiResponse(actionResponse, `perform ${apiAction} action`);
            
      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage);
      
      return screenshotResult || { type: "text", text: `${action} performed successfully at (${x}, ${y}).` };

    } catch (err) {
      console.error(`[PlaywrightMCP] ${action} Error:`, err);
      return {
        type: "text",
        text: `Error: ${err.message}`
      };
    }
  }
);

// --- Keyboard Tools --- 
server.tool(
  "playwright_press_key",
  {
    key: z.string().describe("Name of the key to press (e.g., 'Enter', 'Tab', 'a', 'Shift')."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ key, screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Pressing key: ${key}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pressKey', key: key })
      });
      await checkApiResponse(actionResponse, 'press key');
      
      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage);
      return screenshotResult || { type: "text", text: `Key '${key}' pressed successfully.` };

    } catch (err) {
      console.error('[PlaywrightMCP] Press Key Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);

server.tool(
  "playwright_type_text",
  {
    text: z.string().describe("The text to type into the focused element."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ text, screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Typing text: ${text}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'typeText', text: text })
      });
      await checkApiResponse(actionResponse, 'type text');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage);
      return screenshotResult || { type: "text", text: `Text typed successfully.` };

    } catch (err) {
      console.error('[PlaywrightMCP] Type Text Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);

// --- Advanced Mouse Tools --- 
server.tool(
  "playwright_mouse_move",
  {
    x: z.number().describe("The target x-coordinate (viewport relative).)"),
    y: z.number().describe("The target y-coordinate (viewport relative).)"),
    screenshotAfter: z.boolean().optional().default(false).describe("Whether to take a screenshot after the action (default false)."), // Default false for move
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ x, y, screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Moving mouse to (${x},${y})`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mouseMove', x, y })
      });
      await checkApiResponse(actionResponse, 'move mouse');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage);
      return screenshotResult || { type: "text", text: `Mouse moved to (${x}, ${y}).` };

    } catch (err) {
      console.error('[PlaywrightMCP] Mouse Move Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);

server.tool(
  "playwright_mouse_down",
  {
    x: z.number().describe("The x-coordinate to press down at (viewport relative).)"),
    y: z.number().describe("The y-coordinate to press down at (viewport relative).)"),
    button: z.enum(["left", "right", "middle"]).optional().default('left').describe("Mouse button."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ x, y, button, screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Mouse down at (${x},${y}) with ${button} button`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mouseDown', x, y, button })
      });
      await checkApiResponse(actionResponse, 'mouse down');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage);
      return screenshotResult || { type: "text", text: `Mouse down performed at (${x}, ${y}).` };

    } catch (err) {
      console.error('[PlaywrightMCP] Mouse Down Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);

server.tool(
  "playwright_mouse_up",
  {
    x: z.number().describe("The x-coordinate to release at (viewport relative).)"),
    y: z.number().describe("The y-coordinate to release at (viewport relative).)"),
    button: z.enum(["left", "right", "middle"]).optional().default('left').describe("Mouse button."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ x, y, button, screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Mouse up at (${x},${y}) with ${button} button`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mouseUp', x, y, button })
      });
      await checkApiResponse(actionResponse, 'mouse up');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage);
      return screenshotResult || { type: "text", text: `Mouse up performed at (${x}, ${y}).` };

    } catch (err) {
      console.error('[PlaywrightMCP] Mouse Up Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);

server.tool(
  "playwright_drag",
  {
    startX: z.number().describe("The starting x-coordinate (viewport relative).)"),
    startY: z.number().describe("The starting y-coordinate (viewport relative).)"),
    endX: z.number().describe("The ending x-coordinate (viewport relative).)"),
    endY: z.number().describe("The ending y-coordinate (viewport relative).)"),
    button: z.enum(["left", "right", "middle"]).optional().default('left').describe("Mouse button."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ startX, startY, endX, endY, button, screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Dragging from (${startX},${startY}) to (${endX},${endY}) with ${button} button`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drag', startX, startY, endX, endY, button })
      });
      await checkApiResponse(actionResponse, 'drag');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage);
      return screenshotResult || { type: "text", text: `Drag performed from (${startX}, ${startY}) to (${endX}, ${endY}).` };

    } catch (err) {
      console.error('[PlaywrightMCP] Drag Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);

// --- Scroll Tool --- 
server.tool(
  "playwright_scroll",
  {
    deltaX: z.number().describe("Pixels to scroll horizontally (positive right, negative left).)"),
    deltaY: z.number().describe("Pixels to scroll vertically (positive down, negative up).)"),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ deltaX, deltaY, screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Scrolling by (${deltaX},${deltaY})`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scroll', deltaX, deltaY })
      });
      await checkApiResponse(actionResponse, 'scroll');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage);
      return screenshotResult || { type: "text", text: `Scrolled by (${deltaX}, ${deltaY}).` };

    } catch (err) {
      console.error('[PlaywrightMCP] Scroll Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);


// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

console.log("[PlaywrightMCP] Playwright MCP Server started and connected via Stdio.");