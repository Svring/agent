import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium } from 'playwright';

// BrowserManager logic moved here
class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async launch(headless = true) {
    if (this.browser) return;
    this.browser = await chromium.launch({ headless });
  }

  async newContext(viewport = { width: 1024, height: 768 }) {
    if (!this.browser) throw new Error('Browser must be launched before creating a context.');
    if (this.context) return;
    this.context = await this.browser.newContext({ viewport });
  }

  async newPage() {
    if (!this.context) throw new Error('Context must be created before creating a page.');
    if (this.page) return;
    this.page = await this.context.newPage();
  }

  async goto(url, options = { waitUntil: 'networkidle' }) {
    if (!this.page) throw new Error('Page must be created before navigation.');
    await this.page.goto(url, options);
  }

  async screenshot(options = {}) {
    if (!this.page) throw new Error('Page must be created before taking a screenshot.');
    return await this.page.screenshot(options);
  }

  async closePage() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
  }

  async closeContext() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

const browserManager = new BrowserManager();

// Create an MCP server
const server = new McpServer({
  name: "Playwright",
  version: "1.0.0",
  description: "A tool for navigating and screenshotting web pages using Playwright."
});

// Expose a tool to navigate and screenshot
server.tool(
  "playwright_navigate_and_screenshot",
  {
    url: z.string(),
    headless: z.boolean().optional(),
    viewport: z.object({ width: z.number(), height: z.number() }).optional(),
    fullPage: z.boolean().optional()
  },
  async ({ url, headless = true, viewport = { width: 1024, height: 768 }, fullPage = true }) => {
    try {
      await browserManager.launch(headless);
      await browserManager.newContext(viewport);
      await browserManager.newPage();
      await browserManager.goto(url);
      const screenshotBuffer = await browserManager.screenshot({ fullPage });
      await browserManager.closePage();
      await browserManager.closeContext();
      // Return only the image object
      return {
        type: "image",
        data: screenshotBuffer.toString('base64'),
        mimeType: "image/png"
      };
    } catch (err) {
      return {
        type: "text",
        text: `Error: ${err.message}`
      };
    }
  }
);

// Expose a tool to perform mouse actions at coordinates
server.tool(
  "playwright_mouse_action",
  {
    action: z.enum(["click", "doubleClick", "rightClick"]),
    x: z.number(),
    y: z.number(),
    url: z.string().optional(),
    headless: z.boolean().optional(),
    viewport: z.object({ width: z.number(), height: z.number() }).optional(),
    fullPage: z.boolean().optional()
  },
  async ({ action, x, y, url, headless = true, viewport = { width: 1024, height: 768 }, fullPage = true }) => {
    try {
      await browserManager.launch(headless);
      await browserManager.newContext(viewport);
      await browserManager.newPage();
      if (url) {
        await browserManager.goto(url);
      }
      // Perform the mouse action
      switch (action) {
        case "click":
          await browserManager.page.mouse.click(x, y);
          break;
        case "doubleClick":
          await browserManager.page.mouse.dblclick(x, y);
          break;
        case "rightClick":
          await browserManager.page.mouse.click(x, y, { button: 'right' });
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      const screenshotBuffer = await browserManager.screenshot({ fullPage });
      await browserManager.closePage();
      await browserManager.closeContext();
      return {
        type: "image",
        data: screenshotBuffer.toString('base64'),
        mimeType: "image/png"
      };
    } catch (err) {
      return {
        type: "text",
        text: `Error: ${err.message}`
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);