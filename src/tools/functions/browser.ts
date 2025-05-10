import { z } from 'zod';
import { tool } from 'ai';
import { PlaywrightManager } from '@/backstage/playwright-manager';

// No defaultPageId, pageId will be required by tools.

export const browserScreenshot = tool({
  description: 'Takes a screenshot of a specific page for a user. The image is processed on the server.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose browser session is being controlled."),
    pageId: z.string().describe("The ID of the page to take a screenshot of."),
    fullPage: z.boolean().optional().default(true).describe("Whether to capture the full scrollable page."),
  }),
  execute: async ({ userId, pageId, fullPage }) => {
    try {
      await PlaywrightManager.getInstance().screenshot(userId, pageId, { fullPage, type: 'png' });
      return { success: true, message: `Screenshot of page ${pageId} for user ${userId} taken.` };
    } catch (error: any) {
      return { success: false, error: `Failed to take screenshot for user ${userId}, page ${pageId}: ${error.message}` };
    }
  }
});

export const browserGotoUrl = tool({
  description: 'Navigates a specific page for a user to a new URL.',
  parameters: z.object({
    userId: z.string().describe("User ID."),
    pageId: z.string().describe("Page ID to navigate."),
    url: z.string().url().describe("The URL to navigate to."),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional().default('networkidle'),
  }),
  execute: async ({ userId, pageId, url, waitUntil }) => {
    try {
      await PlaywrightManager.getInstance().goto(userId, url, pageId, { waitUntil });
      return { success: true, message: `User ${userId} navigated page ${pageId} to ${url}.` };
    } catch (error: any) {
      return { success: false, error: `Failed to navigate to ${url} for user ${userId}, page ${pageId}: ${error.message}` };
    }
  }
});

export const browserClickCoordinates = tool({
  description: 'Simulates a mouse click at specified x,y coordinates.',
  parameters: z.object({
    userId: z.string().describe("User ID."),
    pageId: z.string().describe("Page ID."),
    x: z.number().describe("X-coordinate (viewport relative)."),
    y: z.number().describe("Y-coordinate (viewport relative)."),
    button: z.enum(["left", "right", "middle"]).optional().default('left'),
  }),
  execute: async ({ userId, pageId, x, y, button }) => {
    try {
      await PlaywrightManager.getInstance().mouseAction(userId, 'click', x, y, pageId, { button });
      return { success: true, message: `Clicked at (${x},${y}) on page ${pageId} for user ${userId}.` };
    } catch (error: any) {
      return { success: false, error: `Failed to click at (${x},${y}) for user ${userId}, page ${pageId}: ${error.message}` };
    }
  }
});

export const browserTypeText = tool({
  description: 'Types text into the focused element.',
  parameters: z.object({
    userId: z.string().describe("User ID."),
    pageId: z.string().describe("Page ID."),
    text: z.string().describe("Text to type."),
  }),
  execute: async ({ userId, pageId, text }) => {
    try {
      await PlaywrightManager.getInstance().typeText(userId, text, pageId);
      return { success: true, message: `Typed '${text.substring(0,20)}...' on page ${pageId} for user ${userId}.` };
    } catch (error: any) {
      return { success: false, error: `Failed to type text for user ${userId}, page ${pageId}: ${error.message}` };
    }
  }
});

export const browserPressKey = tool({
  description: 'Presses a keyboard key (e.g., Enter, Tab, a, Control+C).',
  parameters: z.object({
    userId: z.string().describe("User ID."),
    pageId: z.string().describe("Page ID."),
    key: z.string().describe("Key to press (e.g., 'Enter', 'Control+C')."),
  }),
  execute: async ({ userId, pageId, key }) => {
    try {
      await PlaywrightManager.getInstance().pressKey(userId, key, pageId);
      return { success: true, message: `Pressed key '${key}' on page ${pageId} for user ${userId}.` };
    } catch (error: any) {
      return { success: false, error: `Failed to press key '${key}' for user ${userId}, page ${pageId}: ${error.message}` };
    }
  }
});

export const browserScrollPage = tool({
  description: 'Scrolls the page.',
  parameters: z.object({
    userId: z.string().describe("User ID."),
    pageId: z.string().describe("Page ID."),
    deltaX: z.number().optional().default(0).describe("Pixels to scroll horizontally."),
    deltaY: z.number().optional().default(0).describe("Pixels to scroll vertically."),
  }),
  execute: async ({ userId, pageId, deltaX = 0, deltaY = 0 }) => {
    if (deltaX === 0 && deltaY === 0) return { success: false, error: "Scroll requires non-zero deltaX or deltaY." };
    try {
      await PlaywrightManager.getInstance().scroll(userId, deltaX, deltaY, pageId);
      return { success: true, message: `Scrolled page ${pageId} for user ${userId} by X:${deltaX}, Y:${deltaY}.` };
    } catch (error: any) {
      return { success: false, error: `Failed to scroll for user ${userId}, page ${pageId}: ${error.message}` };
    }
  }
});

export const browserMouseMove = tool({
    description: "Moves the mouse cursor to specified x,y coordinates.",
    parameters: z.object({
        userId: z.string().describe("User ID."),
        pageId: z.string().describe("Page ID."),
        x: z.number().describe("Target X-coordinate."),
        y: z.number().describe("Target Y-coordinate."),
    }),
    execute: async ({ userId, pageId, x, y }) => {
        try {
            await PlaywrightManager.getInstance().mouseAction(userId, 'move', x, y, pageId, {});
            return { success: true, message: `Mouse moved to (${x},${y}) on page ${pageId} for user ${userId}.` };
        } catch (error: any) {
            return { success: false, error: `Failed to move mouse for user ${userId}, page ${pageId}: ${error.message}` };
        }
    }
});

export const browserMouseAction = tool({
    description: "Performs a mouse button action (down or up) at specified coordinates.",
    parameters: z.object({
        userId: z.string().describe("User ID."),
        pageId: z.string().describe("Page ID."),
        actionType: z.enum(["mouseDown", "mouseUp"]).describe("Type of mouse button action."),
        x: z.number().describe("X-coordinate."),
        y: z.number().describe("Y-coordinate."),
        button: z.enum(["left", "right", "middle"]).optional().default('left'),
    }),
    execute: async ({ userId, pageId, actionType, x, y, button }) => {
        const managerAction = actionType === 'mouseDown' ? 'down' : 'up';
        try {
            await PlaywrightManager.getInstance().mouseAction(userId, managerAction, x, y, pageId, { button });
            return { success: true, message: `Mouse ${actionType} at (${x},${y}) on page ${pageId} for user ${userId}.` };
        } catch (error: any) {
            return { success: false, error: `Failed mouse ${actionType} for user ${userId}, page ${pageId}: ${error.message}` };
        }
    }
});

export const browserDragAndDrop = tool({
    description: "Performs a drag-and-drop operation from a start to an end coordinate.",
    parameters: z.object({
        userId: z.string().describe("User ID."),
        pageId: z.string().describe("Page ID."),
        startX: z.number().describe("Starting X-coordinate."),
        startY: z.number().describe("Starting Y-coordinate."),
        endX: z.number().describe("Ending X-coordinate."),
        endY: z.number().describe("Ending Y-coordinate."),
        button: z.enum(["left", "right", "middle"]).optional().default('left'),
    }),
    execute: async ({ userId, pageId, startX, startY, endX, endY, button }) => {
        try {
            const pm = PlaywrightManager.getInstance();
            await pm.mouseAction(userId, 'move', startX, startY, pageId, { button });
            await pm.mouseAction(userId, 'down', startX, startY, pageId, { button });
            await pm.mouseAction(userId, 'move', endX, endY, pageId, { button }); // Potentially add steps for smoother drag if needed
            await pm.mouseAction(userId, 'up', endX, endY, pageId, { button });
            return { success: true, message: `Drag from (${startX},${startY}) to (${endX},${endY}) on page ${pageId} for user ${userId} complete.` };
        } catch (error: any) {
            return { success: false, error: `Drag failed for user ${userId}, page ${pageId}: ${error.message}` };
        }
    }
});

export const browserGoBack = tool({
    description: "Navigates to the previous page in history for the user on a specific page.",
    parameters: z.object({
        userId: z.string().describe("User ID."),
        pageId: z.string().describe("Page ID."),
    }),
    execute: async ({ userId, pageId }) => {
        try {
            await PlaywrightManager.getInstance().goBack(userId, pageId);
            return { success: true, message: `Navigated back on page ${pageId} for user ${userId}.` };
        } catch (error: any) {
            return { success: false, error: `Go back failed for user ${userId}, page ${pageId}: ${error.message}` };
        }
    }
});

export const browserGoForward = tool({
    description: "Navigates to the next page in history for the user on a specific page.",
    parameters: z.object({
        userId: z.string().describe("User ID."),
        pageId: z.string().describe("Page ID."),
    }),
    execute: async ({ userId, pageId }) => {
        try {
            await PlaywrightManager.getInstance().goForward(userId, pageId);
            return { success: true, message: `Navigated forward on page ${pageId} for user ${userId}.` };
        } catch (error: any) {
            return { success: false, error: `Go forward failed for user ${userId}, page ${pageId}: ${error.message}` };
        }
    }
});

// Group all browser tools for easy import and registration
export const browserTools = {
  browserScreenshot,
  browserGotoUrl,
  browserClickCoordinates,
  browserTypeText,
  browserPressKey,
  browserScrollPage,
  browserMouseMove,
  browserMouseAction,
  browserDragAndDrop,
  browserGoBack,
  browserGoForward,
  // Add other tools like getCookies, createPage, deletePage, renamePage if they are useful for AI.
  // For now, focusing on direct interaction tools.
};

export default browserTools;