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
  private viewportSizes: Map<string, { width: number, height: number }> = new Map();
  private pageToContext: Map<string, string> = new Map();

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
      console.log(`[PlaywrightManager] Closing existing context during recreate: ${id}`);
      await this.closeContext(id);
    }

    const width = options.width || 1024;
    const height = options.height || 768;

    const context = await browser.newContext({
      viewport: { width, height }
    });

    this.contexts.set(id, context);
    // Store the viewport size for this context
    this.viewportSizes.set(id, { width, height });

    console.log(`[PlaywrightManager] Context created with id: ${id}, viewport: ${width}x${height}. Stored size updated.`);
    return context;
  }

  /**
   * Get or create a context
   */
  public async getContext(
    id = 'default',
    options: { width?: number; height?: number } = {}
  ): Promise<BrowserContext> {
    const requestedWidth = options.width || 1024;
    const requestedHeight = options.height || 768;
    console.log(`[PlaywrightManager] getContext called for id: ${id}, requested size: ${requestedWidth}x${requestedHeight}`);

    if (!this.contexts.has(id)) {
      console.log(`[PlaywrightManager] No existing context found for id: ${id}. Creating new context.`);
      return this.createContext(id, { width: requestedWidth, height: requestedHeight });
    }

    const existingSize = this.viewportSizes.get(id);
    console.log(`[PlaywrightManager] Existing context found for id: ${id}. Stored size: ${existingSize?.width}x${existingSize?.height}`);

    // If the viewport size is different, recreate the context
    if (existingSize &&
      (existingSize.width !== requestedWidth ||
        existingSize.height !== requestedHeight)) {
      console.log(`[PlaywrightManager] Viewport size mismatch for id: ${id}. Recreating context.`);
      return this.createContext(id, { width: requestedWidth, height: requestedHeight });
    }

    console.log(`[PlaywrightManager] Returning existing context for id: ${id}.`);
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
    this.pageToContext.set(pageId, contextId);
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
    // If we have viewport size options, make sure the context has that size
    if (options.width || options.height) {
      await this.getContext(contextId, options);
    }

    if (!this.pages.has(pageId)) {
      return this.createPage(contextId, pageId, options);
    }
    return this.pages.get(pageId)!;
  }

  /**
   * Get the current viewport size for a context
   */
  public getViewportSize(contextId = 'default'): { width: number, height: number } {
    const size = this.viewportSizes.get(contextId);
    return size || { width: 1024, height: 768 }; // Default size if not set
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
      const deletedSize = this.viewportSizes.delete(contextId);
      console.log(`[PlaywrightManager] Context closed: ${contextId}. Viewport size entry deleted: ${deletedSize}`);
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
      this.viewportSizes.clear();
      console.log('Browser closed');
    }
  }

  /**
   * Take a screenshot of a page
   */
  public async screenshot(
    pageId = 'default',
    options: { fullPage?: boolean; path?: string, type?: 'png' | 'jpeg', quality?: number } = {}
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
    // Add https:// prefix if not present
    const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    await page.goto(formattedUrl, { waitUntil: options.waitUntil || 'networkidle' });
    console.log(`Navigated to ${formattedUrl} on page ${pageId}`);
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
    console.log(`Performed ${action} at (${x}, ${y}) on page ${pageId}`);
  }

  /**
   * Type text into the currently focused element
   */
  public async typeText(text: string, pageId = 'default'): Promise<void> {
    const page = await this.getPage('default', pageId);
    await page.keyboard.type(text);
    console.log(`Typed text '${text}' on page ${pageId}`);
  }

  /**
   * Press a specific key
   */
  public async pressKey(key: string, pageId = 'default'): Promise<void> {
    const page = await this.getPage('default', pageId);
    await page.keyboard.press(key);
    console.log(`Pressed key '${key}' on page ${pageId}`);
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

  /**
   * Navigate back to the previous page in history
   */
  public async goBack(pageId = 'default', options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' } = {}): Promise<void> {
    const page = await this.getPage('default', pageId);
    await page.goBack({ waitUntil: options.waitUntil || 'networkidle' });
    console.log(`Navigated back on page ${pageId}`);
  }

  /**
   * Navigate forward to the next page in history
   */
  public async goForward(pageId = 'default', options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' } = {}): Promise<void> {
    const page = await this.getPage('default', pageId);
    await page.goForward({ waitUntil: options.waitUntil || 'networkidle' });
    console.log(`Navigated forward on page ${pageId}`);
  }

  public isBrowserInitialized(): boolean {
    return this.browser !== null;
  }

  /**
   * Log cookies for a given context and URL
   */
  public async logCookies(contextId: string = 'default', url: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      console.warn(`Context with id ${contextId} does not exist.`);
      return;
    }
    const cookies = await context.cookies(url);
    console.log(`Cookies for context '${contextId}' at '${url}':`, cookies);
  }

  /**
   * Get the current status of the manager (browser, contexts, pages)
   */
  public getStatus(): {
    browserInitialized: boolean;
    contexts: { id: string }[];
    pages: { id: string, contextId: string | null }[];
  } {
    const contexts = Array.from(this.contexts.keys()).map(id => ({ id }));
    const pages = Array.from(this.pages.keys()).map(id => ({ id, contextId: this.pageToContext.get(id) || null }));
    return {
      browserInitialized: this.browser !== null,
      contexts,
      pages
    };
  }


  async deletePage(contextId: string, pageId: string): Promise<void> {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page ${pageId} not found.`);
    }
    await page.close();
    this.pages.delete(pageId);
    this.pageToContext.delete(pageId);
    console.log(`Deleted page ${pageId} from context ${contextId}`);
    // Check if there are any other pages in this context; if not, close the context
    let hasOtherPages = false;
    for (const [pId, p] of this.pages) {
      if (this.pageToContext.get(pId) === contextId) {
        hasOtherPages = true;
        break;
      }
    }
    if (!hasOtherPages) {
      const context = this.contexts.get(contextId);
      if (context) {
        await context.close();
        this.contexts.delete(contextId);
        console.log(`Closed context ${contextId} as it has no more pages.`);
      }
    }
  }

  async renamePage(contextId: string, oldPageId: string, newPageId: string): Promise<void> {
    const page = this.pages.get(oldPageId);
    if (!page) {
      throw new Error(`Page ${oldPageId} not found.`);
    }
    if (this.pages.has(newPageId)) {
      throw new Error(`Page ID ${newPageId} already exists.`);
    }
    this.pages.delete(oldPageId);
    this.pages.set(newPageId, page);
    // Update context association
    this.pageToContext.delete(oldPageId);
    this.pageToContext.set(newPageId, contextId);
    console.log(`Renamed page from ${oldPageId} to ${newPageId} in context ${contextId}`);
  }
}
