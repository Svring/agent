import { Browser, BrowserContext, Page, chromium } from 'playwright';

/**
 * Singleton class to manage Playwright browser lifecycle
 * Ensures browser stays alive between operations from MCP servers
 */
export class PlaywrightManager {
  private static instance: PlaywrightManager;
  private browser: Browser | null = null;
  // User-specific resources
  private userContexts: Map<string, BrowserContext> = new Map(); // Key: userId
  private userPages: Map<string, Map<string, Page>> = new Map(); // Key: userId, Value: Map<pageId, Page>
  private userViewports: Map<string, { width: number, height: number }> = new Map(); // Key: userId

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
    if (!this.browser || !this.browser.isConnected()) {
      if (this.browser) {
        // Attempt to clean up a disconnected browser instance before relaunching
        try {
          await this.browser.close();
        } catch (e) {
          console.warn("[PlaywrightManager] Error closing disconnected browser instance:", e);
        }
      }
      this.browser = await chromium.launch({ headless });
      console.log('[PlaywrightManager] New browser instance launched');
    }
    return this.browser;
  }

  /**
   * Create or get a browser context for a specific user.
   * Each user gets one primary context associated with their userId.
   */
  public async getUserContext(
    userId: string,
    options: { width?: number; height?: number } = {}
  ): Promise<BrowserContext> {
    if (!userId) throw new Error("[PlaywrightManager] userId is required to get or create a context.");
    await this.ensureBrowser();

    const requestedWidth = options.width || 1024;
    const requestedHeight = options.height || 768;

    if (this.userContexts.has(userId)) {
      const existingContext = this.userContexts.get(userId)!;
      const currentViewport = this.userViewports.get(userId) || { width: 0, height: 0 };

      if (existingContext.pages().length === 0 && (currentViewport.width !== requestedWidth || currentViewport.height !== requestedHeight)) {
         // If context has no pages and viewport needs update, easier to close and recreate
         console.log(`[PlaywrightManager] Recreating context for user ${userId} due to viewport change and no open pages.`);
         await existingContext.close();
         this.userContexts.delete(userId);
         this.userViewports.delete(userId);
         // Fall through to create new context
      } else if (currentViewport.width !== requestedWidth || currentViewport.height !== requestedHeight) {
        // If pages exist, log warning - viewport change for existing contexts with pages is complex.
        // For simplicity, we are not resizing existing pages here. Client should be aware.
        console.warn(`[PlaywrightManager] Viewport change requested for user ${userId} (${requestedWidth}x${requestedHeight}), but context has active pages. Existing pages will retain old viewport. New pages will use new viewport if context is recreated without pages.`);
        // If we strictly need to enforce new viewport for all pages, we'd have to close all pages and recreate context, or resize pages individually.
        // For now, we'll allow context to exist, new pages will be created with the new context default if it's recreated.
      }
       if (existingContext.browser()?.isConnected()) {
        return existingContext;
      } else {
        console.warn(`[PlaywrightManager] Stale context found for user ${userId}. Cleaning up.`);
        this.userContexts.delete(userId);
        this.userViewports.delete(userId);
        const userPageMap = this.userPages.get(userId);
        if (userPageMap) {
          userPageMap.clear(); // Pages are gone with the context
          this.userPages.delete(userId);
        }
      }
    }

    console.log(`[PlaywrightManager] Creating new context for user ${userId} with viewport ${requestedWidth}x${requestedHeight}`);
    const newContext = await this.browser!.newContext({
      viewport: { width: requestedWidth, height: requestedHeight }
    });
    this.userContexts.set(userId, newContext);
    this.userViewports.set(userId, { width: requestedWidth, height: requestedHeight });
    this.userPages.set(userId, new Map<string, Page>()); // Initialize page map for the user
    
    newContext.on('close', () => {
      console.log(`[PlaywrightManager] Context for user ${userId} was closed.`);
      this.userContexts.delete(userId);
      this.userViewports.delete(userId);
      this.userPages.delete(userId); // Remove all pages for this user
    });

    return newContext;
  }

  /**
   * Create a new page for a specific user.
   */
  public async createPage(
    userId: string,
    pageId: string,
    options: { width?: number; height?: number } = {}
  ): Promise<Page> {
    if (!userId || !pageId) throw new Error("[PlaywrightManager] userId and pageId are required to create a page.");
    
    const userContext = await this.getUserContext(userId, options);
    const userPageMap = this.userPages.get(userId)!;

    if (userPageMap.has(pageId)) {
      console.log(`[PlaywrightManager] Page ${pageId} already exists for user ${userId}. Closing and recreating.`);
      await this.closePage(userId, pageId);
    }

    const newPage = await userContext.newPage();
    userPageMap.set(pageId, newPage);
    console.log(`[PlaywrightManager] Page ${pageId} created for user ${userId}`);
    
    newPage.on('close', () => {
      console.log(`[PlaywrightManager] Page ${pageId} for user ${userId} was closed.`);
      userPageMap.delete(pageId);
    });
    return newPage;
  }

  /**
   * Get a page for a specific user. Creates if it doesn't exist.
   */
  public async getPage(
    userId: string,
    pageId: string,
    options: { width?: number; height?: number } = {}
  ): Promise<Page> {
    if (!userId || !pageId) throw new Error("[PlaywrightManager] userId and pageId are required to get a page.");

    // Ensure context exists with potentially updated viewport from options
    await this.getUserContext(userId, options);
    
    const userPageMap = this.userPages.get(userId);
    if (!userPageMap || !userPageMap.has(pageId)) {
      console.log(`[PlaywrightManager] Page ${pageId} not found for user ${userId}. Creating new page.`);
      return this.createPage(userId, pageId, options);
    }
    const page = userPageMap.get(pageId)!;
    if (page.isClosed()){
        console.log(`[PlaywrightManager] Stale page ${pageId} found for user ${userId}. Recreating.`);
        userPageMap.delete(pageId);
        return this.createPage(userId, pageId, options);
    }
    return page;
  }

  /**
   * Get the current viewport size for a user's context
   */
  public getViewportSize(userId: string): { width: number, height: number } {
    if (!userId) throw new Error("[PlaywrightManager] userId is required to get viewport size.");
    return this.userViewports.get(userId) || { width: 1024, height: 768 }; // Default if not set
  }
  
  /**
   * Set viewport size for a user's context.
   * This will affect new pages. Existing pages are not resized by this method directly.
   * If context is empty, it might be recreated with the new size on next getContext/getPage.
   */
  public async setViewportSize(userId: string, width: number, height: number): Promise<void> {
    if (!userId) throw new Error("[PlaywrightManager] userId is required to set viewport size.");
    // This updates the desired viewport for the user's context.
    // getUserContext will handle recreation if conditions are met.
    await this.getUserContext(userId, { width, height });
    console.log(`[PlaywrightManager] Viewport preference for user ${userId} updated to ${width}x${height}. Context may be recreated on next access if empty.`);
  }


  /**
   * Close a specific page for a user
   */
  public async closePage(userId: string, pageId: string): Promise<void> {
    if (!userId || !pageId) throw new Error("[PlaywrightManager] userId and pageId are required to close a page.");
    const userPageMap = this.userPages.get(userId);
    if (userPageMap && userPageMap.has(pageId)) {
      const page = userPageMap.get(pageId)!;
      try {
        if(!page.isClosed()) {
          await page.close(); // Event listener on page will handle map deletion
        }
      } catch (e) {
         console.warn(`[PlaywrightManager] Error closing page ${pageId} for user ${userId}:`, e);
      } finally {
        // Ensure it's removed from map even if close event didn't fire or errored
        userPageMap.delete(pageId);
      }
      console.log(`[PlaywrightManager] Page ${pageId} closed for user ${userId}`);
    } else {
      console.log(`[PlaywrightManager] Page ${pageId} not found for user ${userId}, cannot close.`);
    }
  }

  /**
   * Close a specific user's context and all their pages
   */
  public async closeUserContext(userId: string): Promise<void> {
    if (!userId) throw new Error("[PlaywrightManager] userId is required to close a context.");
    const context = this.userContexts.get(userId);
    if (context) {
      try {
        if(context.browser()?.isConnected()){ // Check if context itself is still valid
          await context.close(); // Event listener on context will handle map deletions
        }
      } catch(e) {
        console.warn(`[PlaywrightManager] Error closing context for user ${userId}:`, e);
      } finally {
        // Ensure cleanup even if close event didn't fire or errored
        this.userContexts.delete(userId);
        this.userViewports.delete(userId);
        this.userPages.delete(userId);
      }
      console.log(`[PlaywrightManager] Context and all pages for user ${userId} closed.`);
    } else {
      console.log(`[PlaywrightManager] Context not found for user ${userId}, cannot close.`);
    }
  }

  /**
   * Close the browser and all user contexts and pages
   */
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      // Create a copy of user IDs to iterate over, as closing contexts will modify the map
      const userIds = Array.from(this.userContexts.keys());
      for (const userId of userIds) {
        await this.closeUserContext(userId); // This will close pages too
      }
      try {
        await this.browser.close();
      } catch (e) {
        console.warn("[PlaywrightManager] Error closing main browser instance:", e);
      }
      this.browser = null;
      // Maps should be cleared by closeUserContext event handlers
      console.log('[PlaywrightManager] Browser closed, all user contexts and pages cleared.');
    }
  }
  
  public isBrowserInitialized(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Take a screenshot of a page
   */
  public async screenshot(
    userId: string,
    pageId: string,
    options: { fullPage?: boolean; path?: string, type?: 'png' | 'jpeg', quality?: number } = {}
  ): Promise<Buffer> {
    const page = await this.getPage(userId, pageId);
    return await page.screenshot(options);
  }

  /**
   * Navigate to a URL
   */
  public async goto(
    userId: string,
    url: string,
    pageId: string,
    options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' } = {}
  ): Promise<void> {
    const page = await this.getPage(userId, pageId);
    // Add https:// prefix if not present
    const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    await page.goto(formattedUrl, { waitUntil: options.waitUntil || 'networkidle' });
    console.log(`Navigated to ${formattedUrl} on page ${pageId} for user ${userId}`);
  }

  /**
   * Perform a mouse action
   */
  public async mouseAction(
    userId: string,
    action: 'click' | 'move' | 'down' | 'up' | 'dblclick',
    x: number,
    y: number,
    pageId: string,
    options: { button?: 'left' | 'right' | 'middle' } = {}
  ): Promise<void> {
    const page = await this.getPage(userId, pageId);

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
    console.log(`Performed ${action} at (${x}, ${y}) on page ${pageId} for user ${userId}`);
  }

  /**
   * Type text into the currently focused element
   */
  public async typeText(userId: string, text: string, pageId: string): Promise<void> {
    const page = await this.getPage(userId, pageId);
    await page.keyboard.type(text);
    console.log(`Typed text '${text}' on page ${pageId} for user ${userId}`);
  }

  /**
   * Press a specific key
   */
  public async pressKey(userId: string, key: string, pageId: string): Promise<void> {
    const page = await this.getPage(userId, pageId);
    await page.keyboard.press(key);
    console.log(`Pressed key '${key}' on page ${pageId} for user ${userId}`);
  }

  /**
   * Scroll the page using the mouse wheel
   */
  public async scroll(
    userId: string,
    deltaX: number,
    deltaY: number,
    pageId: string
  ): Promise<void> {
    const page = await this.getPage(userId, pageId);
    await page.mouse.wheel(deltaX, deltaY);
    console.log(`Scrolled by (${deltaX}, ${deltaY}) on page ${pageId} for user ${userId}`);
  }

  /**
   * Navigate back to the previous page in history
   */
  public async goBack(userId: string, pageId: string, options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' } = {}): Promise<void> {
    const page = await this.getPage(userId, pageId);
    await page.goBack({ waitUntil: options.waitUntil || 'networkidle' });
    console.log(`Navigated back on page ${pageId} for user ${userId}`);
  }

  /**
   * Navigate forward to the next page in history
   */
  public async goForward(userId: string, pageId: string, options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' } = {}): Promise<void> {
    const page = await this.getPage(userId, pageId);
    await page.goForward({ waitUntil: options.waitUntil || 'networkidle' });
    console.log(`Navigated forward on page ${pageId} for user ${userId}`);
  }

  /**
   * Log cookies for a given context and URL
   */
  public async logCookies(userId: string, contextId: string = 'default', url: string): Promise<void> {
    const context = this.userContexts.get(userId);
    if (!context) {
      console.warn(`Context with id ${contextId} does not exist.`);
      return;
    }
    const cookies = await context.cookies(url);
    console.log(`Cookies for context '${contextId}' at '${url}':`, cookies);
  }

  /**
   * Get the current status of the manager (browser, and user-specific contexts/pages)
   * If userId is provided, returns status specific to that user.
   * Otherwise, returns a global overview (more for admin/debug).
   */
  public getStatus(userId?: string): any {
    if (userId) {
      const context = this.userContexts.get(userId);
      const pageMap = this.userPages.get(userId);
      const viewport = this.userViewports.get(userId);
      return {
        browserInitialized: this.isBrowserInitialized(),
        userContextExists: !!context,
        userPages: pageMap ? Array.from(pageMap.keys()).map(id => ({ id })) : [],
        userViewport: viewport
      };
    }
    // Global status (admin/debug)
    return {
      browserInitialized: this.isBrowserInitialized(),
      activeUserContexts: Array.from(this.userContexts.keys()),
      totalPagesAcrossUsers: Array.from(this.userPages.values()).reduce((acc, pageMap) => acc + pageMap.size, 0),
    };
  }

  async deletePage(userId: string, contextId: string, pageId: string): Promise<void> {
    const page = this.userPages.get(userId)?.get(pageId);
    if (!page) {
      throw new Error(`Page ${pageId} not found.`);
    }
    await page.close();
    this.userPages.get(userId)?.delete(pageId);
    console.log(`Deleted page ${pageId} from context ${contextId} for user ${userId}`);
    // Check if there are any other pages in this context; if not, close the context
    let hasOtherPages = false;
    for (const [pId, p] of this.userPages.get(userId) || []) {
      if (pId !== pageId) {
        hasOtherPages = true;
        break;
      }
    }
    if (!hasOtherPages) {
      const context = this.userContexts.get(userId);
      if (context) {
        await context.close();
        this.userContexts.delete(userId);
        console.log(`Closed context ${contextId} for user ${userId} as it has no more pages.`);
      }
    }
  }

  async renamePage(userId: string, contextId: string, oldPageId: string, newPageId: string): Promise<void> {
    const page = this.userPages.get(userId)?.get(oldPageId);
    if (!page) {
      throw new Error(`Page ${oldPageId} not found.`);
    }
    if (this.userPages.get(userId)?.has(newPageId)) {
      throw new Error(`Page ID ${newPageId} already exists.`);
    }
    this.userPages.get(userId)?.delete(oldPageId);
    this.userPages.get(userId)?.set(newPageId, page);
    console.log(`Renamed page from ${oldPageId} to ${newPageId} in context ${contextId} for user ${userId}`);
  }
}
