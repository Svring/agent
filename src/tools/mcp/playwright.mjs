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
async function takeScreenshotIfRequested(screenshotAfter = true, fullPage = true, contextId = 'opera', pageId = 'main') {
  if (!screenshotAfter) {
    return null; // Indicate no screenshot was taken
  }
  const screenshotResponse = await fetch(PLAYWRIGHT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'screenshot',
      contextId,
      pageId,
      options: { fullPage, type: 'jpeg', quality: 80 }
    })
  });
  await checkApiResponse(screenshotResponse, 'take screenshot after action');
  const screenshotResult = await screenshotResponse.json();
  return {
    type: "image",
    data: screenshotResult.data,
    mimeType: "image/jpeg"
  };
}

// Create an MCP server
const server = new McpServer({
  name: "Playwright",
  version: "1.0.0",
  description: "Provides tools to interact with a server-managed mini-browser for viewing and controlling websites. Available actions include taking screenshots, simulating mouse clicks/drags/scrolls, and typing text/keys. This tool only performs these interactions; browser initialization and cleanup must be handled separately. If the browser is not ready (e.g., not initialized), report the error and await user instructions."
});

// --- Screenshot Tool --- 
server.tool(
  "playwright_screenshot",
  {
    fullPage: z.boolean().optional().describe("Whether to capture the full scrollable page."),
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to take a screenshot of.")
  },
  async ({ fullPage = true, contextId = 'opera', pageId = 'main' }) => {
    try {
      console.log(`[PlaywrightMCP] Taking screenshot of page ${pageId} in context ${contextId}.`);
      
      const screenshotResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'screenshot',
          contextId,
          pageId,
          options: { fullPage, type: 'jpeg', quality: 80 }
        })
      });
      await checkApiResponse(screenshotResponse, 'take screenshot');
      
      const screenshotResult = await screenshotResponse.json();
      
      return {
        type: "image",
        data: screenshotResult.data,
        mimeType: "image/jpeg"
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
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to perform the action on."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ action, x, y, contextId = 'opera', pageId = 'main', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Performing ${action} at (${x},${y}) on page ${pageId} in context ${contextId}`);
                  
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
          button: button,
          contextId,
          pageId
        })
      });
      await checkApiResponse(actionResponse, `perform ${apiAction} action`);
            
      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      
      return screenshotResult || { type: "text", text: `${action} performed successfully at (${x}, ${y}) on page ${pageId}.` };

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
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to press the key on."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ key, contextId = 'opera', pageId = 'main', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Pressing key: ${key} on page ${pageId} in context ${contextId}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pressKey', key: key, contextId, pageId })
      });
      await checkApiResponse(actionResponse, 'press key');
      
      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      return screenshotResult || { type: "text", text: `Key '${key}' pressed successfully on page ${pageId}.` };

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
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to type text on."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ text, contextId = 'opera', pageId = 'main', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Typing text: ${text} on page ${pageId} in context ${contextId}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'typeText', text: text, contextId, pageId })
      });
      await checkApiResponse(actionResponse, 'type text');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      return screenshotResult || { type: "text", text: `Text typed successfully on page ${pageId}.` };

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
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to move the mouse on."),
    screenshotAfter: z.boolean().optional().default(false).describe("Whether to take a screenshot after the action (default false)."), // Default false for move
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ x, y, contextId = 'opera', pageId = 'main', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Moving mouse to (${x},${y}) on page ${pageId} in context ${contextId}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mouseMove', x, y, contextId, pageId })
      });
      await checkApiResponse(actionResponse, 'move mouse');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      return screenshotResult || { type: "text", text: `Mouse moved to (${x}, ${y}) on page ${pageId}.` };

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
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to perform mouse down on."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ x, y, button, contextId = 'opera', pageId = 'main', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Mouse down at (${x},${y}) with ${button} button on page ${pageId} in context ${contextId}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mouseDown', x, y, button, contextId, pageId })
      });
      await checkApiResponse(actionResponse, 'mouse down');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      return screenshotResult || { type: "text", text: `Mouse down performed at (${x}, ${y}) on page ${pageId}.` };

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
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to perform mouse up on."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ x, y, button, contextId = 'opera', pageId = 'main', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Mouse up at (${x},${y}) with ${button} button on page ${pageId} in context ${contextId}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mouseUp', x, y, button, contextId, pageId })
      });
      await checkApiResponse(actionResponse, 'mouse up');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      return screenshotResult || { type: "text", text: `Mouse up performed at (${x}, ${y}) on page ${pageId}.` };

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
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to perform the drag on."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ startX, startY, endX, endY, button, contextId = 'opera', pageId = 'main', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Dragging from (${startX},${startY}) to (${endX},${endY}) with ${button} button on page ${pageId} in context ${contextId}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drag', startX, startY, endX, endY, button, contextId, pageId })
      });
      await checkApiResponse(actionResponse, 'drag');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      return screenshotResult || { type: "text", text: `Drag performed from (${startX}, ${startY}) to (${endX}, ${endY}) on page ${pageId}.` };

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
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to scroll on."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after the action."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-action screenshot should capture the full page.")
  },
  async ({ deltaX, deltaY, contextId = 'opera', pageId = 'main', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Scrolling by (${deltaX},${deltaY}) on page ${pageId} in context ${contextId}`);
      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scroll', deltaX, deltaY, contextId, pageId })
      });
      await checkApiResponse(actionResponse, 'scroll');

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      return screenshotResult || { type: "text", text: `Scrolled by (${deltaX}, ${deltaY}) on page ${pageId}.` };

    } catch (err) {
      console.error('[PlaywrightMCP] Scroll Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);

// --- Navigation Tool ---
server.tool(
  "playwright_goto",
  {
    url: z.string().describe("The URL to navigate to."),
    contextId: z.string().optional().default('opera').describe("The ID of the context to interact with."),
    pageId: z.string().optional().default('main').describe("The ID of the page to navigate."),
    width: z.number().optional().describe("Optional viewport width to set for the navigation context."),
    height: z.number().optional().describe("Optional viewport height to set for the navigation context."),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional().default('networkidle').describe("Wait until condition."),
    screenshotAfter: z.boolean().optional().default(true).describe("Whether to take a screenshot after navigation."),
    fullPage: z.boolean().optional().default(true).describe("Whether the post-navigation screenshot should capture the full page.")
  },
  async ({ url, contextId = 'opera', pageId = 'main', width, height, waitUntil = 'networkidle', screenshotAfter, fullPage }) => {
    try {
      console.log(`[PlaywrightMCP] Navigating page ${pageId} in context ${contextId} to URL: ${url}`);

      const requestBody = {
        action: 'goto',
        url,
        contextId,
        pageId,
        width, 
        height,
        options: { waitUntil }
      };

      const actionResponse = await fetch(PLAYWRIGHT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      await checkApiResponse(actionResponse, `navigate to ${url}`);

      const screenshotResult = await takeScreenshotIfRequested(screenshotAfter, fullPage, contextId, pageId);
      return screenshotResult || { type: "text", text: `Successfully navigated page ${pageId} to ${url}.` };

    } catch (err) {
      console.error('[PlaywrightMCP] Goto Error:', err);
      return { type: "text", text: `Error: ${err.message}` };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

console.log("[PlaywrightMCP] Playwright MCP Server started and connected via Stdio.");