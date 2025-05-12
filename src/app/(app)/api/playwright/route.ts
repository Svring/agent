import { NextResponse, NextRequest } from 'next/server';
import { PlaywrightManager } from '@/backstage/playwright-manager'; // Assuming correct path
import { Page } from 'playwright';
import { getAuthenticatedUserId } from '@/lib/auth-utils'; // Import the new auth utility

// Coordinate transformation removed.
// Coordinates (x, y, startX/Y, endX/Y) are now expected to be relative to the actual viewport.

// Type for mouse button options
type MouseButton = 'left' | 'right' | 'middle';

interface RequestBody {
  action: 'init' | 'cleanup' | 'goto' | 'screenshot' | 'click' |
  'pressKey' | 'typeText' | 'mouseMove' | 'doubleClick' |
  'mouseDown' | 'mouseUp' | 'cursor_position' |
  'scroll' | 'drag' | 'getViewportSize' | 'setViewportSize' | 'goBack' | 'goForward' | 'getCookies' | 'getStatus' | 'createPage' | 'deletePage' | 'renamePage' | 'closeUserContext';
  url?: string;
  x?: number;         // Viewport coordinate
  y?: number;         // Viewport coordinate
  key?: string;       // For pressKey
  text?: string;      // For typeText
  button?: MouseButton;// For click, mouseDown, mouseUp, drag
  deltaX?: number;    // For scroll
  deltaY?: number;    // For scroll
  startX?: number;    // Viewport coordinate for drag start
  startY?: number;    // Viewport coordinate for drag start
  endX?: number;      // Viewport coordinate for drag end
  endY?: number;      // Viewport coordinate for drag end
  width?: number;     // Viewport width
  height?: number;    // Viewport height
  userId?: string;    // Added userId, can be extracted from auth headers ideally
  pageId?: string;    // For specifying page
  newPageId?: string; // For renaming page
  options?: any;      // Generic options for playwright methods
}

// Coordinate transformation function REMOVED

export async function POST(request: NextRequest) {
  let requestBody: RequestBody | null = null;
  let action: RequestBody['action'] | undefined = undefined;
  let authenticatedUserId: string | null = null;

  try {
    authenticatedUserId = await getAuthenticatedUserId(request.headers);
    // console.log("[Playwright API] Authenticated user ID:", authenticatedUserId);
    if (request.body) {
      requestBody = await request.json();
      action = requestBody?.action;
    }

    if (!action) {
      return NextResponse.json({ success: false, message: 'Action is required.' }, { status: 400 });
    }

    const manager = PlaywrightManager.getInstance();

    // Handle global actions first
    if (action === 'cleanup') {
      await manager.closeBrowser();
      return NextResponse.json({ success: true, message: 'Global browser instance and all user contexts closed.' });
    }
    if (action === 'getStatus' && !authenticatedUserId) {
      const status = manager.getStatus(); // Global status
      return NextResponse.json({ success: true, status });
    }

    // For all other actions, authenticatedUserId is required
    if (!authenticatedUserId) {
      return NextResponse.json({ success: false, message: 'Authentication required for this action.' }, { status: 401 });
    }

    // Default pageId and contextId for user-specific actions
    const pageId = requestBody?.pageId || 'main';
    const contextId = "opera"; // Placeholder/default contextId for methods that might still use it with userId

    // User-specific actions from here, authenticatedUserId is guaranteed to be non-null
    switch (action) {
      case 'init': {
        const width = requestBody?.width || 1024;
        const height = requestBody?.height || 768;
        await manager.getUserContext(authenticatedUserId, { width, height });
        await manager.getPage(authenticatedUserId, pageId, { width, height });
        await manager.goto(authenticatedUserId, 'https://google.com', pageId, requestBody?.options || {});
        const viewportSize = manager.getViewportSize(authenticatedUserId);
        return NextResponse.json({
          success: true,
          message: `Context for user ${authenticatedUserId} initialized with page '${pageId}', viewport ${viewportSize.width}x${viewportSize.height}.`,
          viewport: viewportSize
        });
      }

      case 'closeUserContext':
        await manager.closeUserContext(authenticatedUserId);
        return NextResponse.json({ success: true, message: `Context for user ${authenticatedUserId} closed.` });

      case 'goto': {
        if (!requestBody?.url) return NextResponse.json({ success: false, message: 'URL is required.' }, { status: 400 });
        await manager.goto(authenticatedUserId, requestBody.url, pageId, requestBody.options || {});
        return NextResponse.json({ success: true, message: `User ${authenticatedUserId} navigated page ${pageId} to ${requestBody.url}` });
      }

      case 'screenshot': {
        const options = requestBody?.options || {};
        const buffer = await manager.screenshot(authenticatedUserId, pageId, options);
        const mimeType = options.type === 'jpeg' ? 'image/jpeg' : 'image/png';
        const viewportSize = manager.getViewportSize(authenticatedUserId);
        return NextResponse.json({
          success: true, message: `Screenshot for user ${authenticatedUserId}, page ${pageId}`,
          data: buffer.toString('base64'), mimeType, viewport: viewportSize
        });
      }

      case 'getViewportSize': {
        const viewportSize = manager.getViewportSize(authenticatedUserId);
        return NextResponse.json({ success: true, message: 'Viewport size retrieved.', viewport: viewportSize });
      }

      case 'setViewportSize': {
        const { width, height } = requestBody || {};
        if (!width || !height) return NextResponse.json({ success: false, message: 'Width and height required.' }, { status: 400 });
        await manager.setViewportSize(authenticatedUserId, width, height);
        return NextResponse.json({ success: true, message: `Viewport for user ${authenticatedUserId} set to ${width}x${height}.`, viewport: { width, height } });
      }

      case 'pressKey':
        if (!requestBody?.key) return NextResponse.json({ success: false, message: 'key is required.' }, { status: 400 });
        await manager.pressKey(authenticatedUserId, requestBody.key, pageId);
        return NextResponse.json({ success: true, message: `User ${authenticatedUserId} pressed key ${requestBody.key} on page ${pageId}` });

      case 'typeText':
        if (requestBody?.text === undefined) return NextResponse.json({ success: false, message: 'text is required.' }, { status: 400 });
        await manager.typeText(authenticatedUserId, requestBody.text, pageId);
        return NextResponse.json({ success: true, message: `User ${authenticatedUserId} typed on page ${pageId}` });

      case 'mouseMove':
      case 'click':
      case 'doubleClick':
      case 'mouseDown':
      case 'mouseUp': {
        const { x, y, button = 'left' } = requestBody || {};
        if (x === undefined || y === undefined) return NextResponse.json({ success: false, message: 'x and y required.' }, { status: 400 });
        const managerAction = action === 'mouseMove' ? 'move' : action === 'mouseDown' ? 'down' : action === 'mouseUp' ? 'up' : action === 'doubleClick' ? 'dblclick' : 'click';
        await manager.mouseAction(authenticatedUserId, managerAction, x, y, pageId, { ...requestBody?.options, button });
        return NextResponse.json({ success: true, message: `User ${authenticatedUserId} action ${action} on page ${pageId}` });
      }

      case 'scroll': {
        const { deltaX = 0, deltaY = 0 } = requestBody || {};
        await manager.scroll(authenticatedUserId, deltaX, deltaY, pageId);
        return NextResponse.json({ success: true, message: `User ${authenticatedUserId} scrolled page ${pageId}` });
      }

      case 'goBack':
        await manager.goBack(authenticatedUserId, pageId, requestBody?.options || {});
        return NextResponse.json({ success: true, message: `User ${authenticatedUserId} navigated back on page ${pageId}` });

      case 'goForward':
        await manager.goForward(authenticatedUserId, pageId, requestBody?.options || {});
        return NextResponse.json({ success: true, message: `User ${authenticatedUserId} navigated forward on page ${pageId}` });

      case 'drag': {
        const { startX, startY, endX, endY, button = 'left' } = requestBody || {};
        if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) return NextResponse.json({ success: false, message: 'Drag coordinates required.' }, { status: 400 });
        await manager.mouseAction(authenticatedUserId, 'move', startX, startY, pageId, { button });
        await manager.mouseAction(authenticatedUserId, 'down', startX, startY, pageId, { button });
        await manager.mouseAction(authenticatedUserId, 'move', endX, endY, pageId, { button });
        await manager.mouseAction(authenticatedUserId, 'up', endX, endY, pageId, { button });
        return NextResponse.json({ success: true, message: `User ${authenticatedUserId} dragged on page ${pageId}` });
      }

      case 'getCookies': {
        const url = requestBody?.url;
        if (!url) return NextResponse.json({ success: false, message: 'URL required.' }, { status: 400 });
        const cookies = await manager.logCookies(authenticatedUserId, contextId, url);
        return NextResponse.json({ success: true, cookies });
      }

      case 'getStatus': { // User-specific status (authenticatedUserId is guaranteed non-null here)
        const status = manager.getStatus(authenticatedUserId);
        return NextResponse.json({ success: true, status });
      }

      case 'createPage': {
        const newPageId = requestBody?.pageId || `page-${Date.now()}`;
        const { width, height, url } = requestBody || {};
        await manager.createPage(authenticatedUserId, newPageId, { width, height });
        if (url) {
          await manager.goto(authenticatedUserId, url, newPageId, requestBody?.options || {});
        }
        return NextResponse.json({ success: true, message: `Page ${newPageId} created for user ${authenticatedUserId}.`, pageId: newPageId, userId: authenticatedUserId });
      }

      case 'deletePage': {
        if (!requestBody?.pageId) return NextResponse.json({ success: false, message: 'pageId required.' }, { status: 400 });
        await manager.deletePage(authenticatedUserId, contextId, requestBody.pageId);
        return NextResponse.json({ success: true, message: `Page ${requestBody.pageId} deleted for user ${authenticatedUserId} from context ${contextId}.` });
      }

      case 'renamePage': {
        const { pageId: oldPageId, newPageId } = requestBody || {};
        if (!oldPageId || !newPageId) return NextResponse.json({ success: false, message: 'oldPageId and newPageId required.' }, { status: 400 });
        await manager.renamePage(authenticatedUserId, contextId, oldPageId, newPageId);
        return NextResponse.json({ success: true, message: `Page for user ${authenticatedUserId} in context ${contextId} renamed from ${oldPageId} to ${newPageId}.` });
      }

      default:
        // This should ideally be caught by TypeScript if all action types are covered
        console.warn("[Playwright API] Unhandled action type:", action);
        return NextResponse.json({ success: false, message: 'Invalid or unhandled action specified.' }, { status: 400 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Playwright API Error] Action [${action || 'unknown'}] User [${authenticatedUserId || 'unknown'}]:`, error);
    return NextResponse.json(
      { success: false, message: `Failed to process action ${action || 'unknown'}: ${errorMessage}` },
      { status: 500 }
    );
  }
}
