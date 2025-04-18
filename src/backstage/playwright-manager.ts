import { Browser, BrowserContext, Page, chromium } from 'playwright';

/**
 * Singleton class to manage Playwright browser lifecycle
 * Ensures browser stays alive between operations from MCP servers
 */
export class PlaywrightManager {
  private static instance: PlaywrightManager;
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private pages: Map<string, Page> = new Map();

  private constructor() { }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PlaywrightManager {
    if (!PlaywrightManager.instance) {
      PlaywrightManager.instance = new PlaywrightManager();
    }
    return PlaywrightManager.instance;
  }

  /**
   * Launch browser if not already launched
   */
  public async ensureBrowser(headless = true): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless });
      console.log('Browser launched');
    }
    return this.browser;
  }

  /**
   * Create a new browser context with optional ID
   */
  public async createContext(
    id = 'default',
    options: { width?: number; height?: number } = {}
  ): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();

    // Close existing context with this ID if it exists
    if (this.contexts.has(id)) {
      await this.closeContext(id);
    }

    const context = await browser.newContext({
      viewport: {
        width: options.width || 1024,
        height: options.height || 768
      }
    });

    this.contexts.set(id, context);
    console.log(`Context created with id: ${id}`);
    return context;
  }

  /**
   * Get or create a context
   */
  public async getContext(
    id = 'default',
    options: { width?: number; height?: number } = {}
  ): Promise<BrowserContext> {
    if (!this.contexts.has(id)) {
      return this.createContext(id, options);
    }
    return this.contexts.get(id)!;
  }

  /**
   * Create a new page with optional ID
   */
  public async createPage(
    contextId = 'default',
    pageId = 'default',
    options: { width?: number; height?: number } = {}
  ): Promise<Page> {
    const context = await this.getContext(contextId, options);

    // Close existing page with this ID if it exists
    if (this.pages.has(pageId)) {
      await this.closePage(pageId);
    }

    const page = await context.newPage();
    this.pages.set(pageId, page);
    console.log(`Page created with id: ${pageId} in context: ${contextId}`);
    return page;
  }

  /**
   * Get or create a page
   */
  public async getPage(
    contextId = 'default',
    pageId = 'default',
    options: { width?: number; height?: number } = {}
  ): Promise<Page> {
    if (!this.pages.has(pageId)) {
      return this.createPage(contextId, pageId, options);
    }
    return this.pages.get(pageId)!;
  }

  /**
   * Close a specific page
   */
  public async closePage(pageId: string): Promise<void> {
    if (this.pages.has(pageId)) {
      const page = this.pages.get(pageId)!;
      await page.close();
      this.pages.delete(pageId);
      console.log(`Page closed: ${pageId}`);
    }
  }

  /**
   * Close a specific context and all its pages
   */
  public async closeContext(contextId: string): Promise<void> {
    if (this.contexts.has(contextId)) {
      // Close all pages in this context
      for (const [pageId, page] of this.pages.entries()) {
        if (page.context() === this.contexts.get(contextId)) {
          await page.close();
          this.pages.delete(pageId);
        }
      }

      // Close the context
      await this.contexts.get(contextId)!.close();
      this.contexts.delete(contextId);
      console.log(`Context closed: ${contextId}`);
    }
  }

  /**
   * Close the browser and all its contexts and pages
   */
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      // Pages will be closed automatically when contexts are closed
      for (const contextId of this.contexts.keys()) {
        await this.closeContext(contextId);
      }

      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }

  /**
   * Take a screenshot of a page
   */
  public async screenshot(
    pageId = 'default',
    options: { fullPage?: boolean; path?: string } = {}
  ): Promise<Buffer> {
    const page = await this.getPage('default', pageId);
    return await page.screenshot(options);
  }

  /**
   * Navigate to a URL
   */
  public async goto(
    url: string,
    pageId = 'default',
    options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' } = {}
  ): Promise<void> {
    const page = await this.getPage('default', pageId);
    await page.goto(url, { waitUntil: options.waitUntil || 'networkidle' });
  }

  /**
   * Perform a mouse action
   */
  public async mouseAction(
    action: 'click' | 'move' | 'down' | 'up' | 'dblclick',
    x: number,
    y: number,
    pageId = 'default',
    options: { button?: 'left' | 'right' | 'middle' } = {}
  ): Promise<void> {
    const page = await this.getPage('default', pageId);

    switch (action) {
      case 'click':
        await page.mouse.click(x, y, { button: options.button || 'left' });
        break;
      case 'move':
        await page.mouse.move(x, y);
        break;
      case 'down':
        await page.mouse.down({ button: options.button || 'left' });
        break;
      case 'up':
        await page.mouse.up({ button: options.button || 'left' });
        break;
      case 'dblclick':
        await page.mouse.dblclick(x, y, { button: options.button || 'left' });
        break;
    }
  }

  /**
   * Type text into the currently focused element
   */
  public async typeText(text: string, pageId = 'default'): Promise<void> {
    const page = await this.getPage('default', pageId);
    await page.keyboard.type(text);
  }

  /**
   * Press a specific key
   */
  public async pressKey(key: string, pageId = 'default'): Promise<void> {
    const page = await this.getPage('default', pageId);
    await page.keyboard.press(key);
  }

  /**
   * Scroll the page using the mouse wheel
   */
  public async scroll(
    deltaX: number,
    deltaY: number,
    pageId = 'default'
  ): Promise<void> {
    const page = await this.getPage('default', pageId);
    await page.mouse.wheel(deltaX, deltaY);
    console.log(`Scrolled by (${deltaX}, ${deltaY}) on page ${pageId}`);
  }

  public isBrowserInitialized(): boolean {
    return this.browser !== null;
  }
}
