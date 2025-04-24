import { NextResponse, NextRequest } from 'next/server';
import { PlaywrightManager } from '@/backstage/playwright-manager'; // Assuming correct path
import { Page } from 'playwright';

// Coordinate transformation removed.
// Coordinates (x, y, startX/Y, endX/Y) are now expected to be relative to the actual viewport.

// Type for mouse button options
type MouseButton = 'left' | 'right' | 'middle';

interface RequestBody {
  action: 'init' | 'cleanup' | 'goto' | 'screenshot' | 'click' |
  'pressKey' | 'typeText' | 'mouseMove' | 'doubleClick' |
  'mouseDown' | 'mouseUp' | 'cursor_position' |
  'scroll' | 'drag' | 'getViewportSize' | 'setViewportSize' | 'goBack' | 'goForward' | 'getCookies' | 'getStatus' | 'createPage' | 'deletePage' | 'renamePage';
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
  contextId?: string; // For specifying context
  pageId?: string;    // For specifying page
  newPageId?: string; // For renaming page
  options?: any;      // Generic options for playwright methods
}

// Coordinate transformation function REMOVED

export async function POST(request: NextRequest) {
  let requestBody: RequestBody | null = null;
  let action: RequestBody['action'] | undefined = undefined;

  try {
    // Parse request body
    if (request.body) {
      requestBody = await request.json();
      action = requestBody?.action;
    }

    // Ensure action is provided
    if (!action) {
      return NextResponse.json({ success: false, message: 'Action is required in the request body.' }, { status: 400 });
    }

    // console.log(`Received playwright request with action: ${action}`);

    const manager = PlaywrightManager.getInstance();

    // No need to get page/viewport here anymore unless specifically needed by an action
    // let page: Page | null = null;
    // let viewportSize: { width: number; height: number } | null = null;

    // Ensure browser is initialized for actions other than 'init' and 'cleanup'
    if (action !== 'init' && action !== 'cleanup') {
      if (!manager.isBrowserInitialized()) {
        return NextResponse.json({ success: false, message: `Browser not initialized. Please call 'init' first.` }, { status: 400 });
      }
      // Getting page might still be needed implicitly by manager methods
    }

    // Coordinate transformation helper REMOVED

    // --- Action Handling --- 
    switch (action) {
      case 'init': {
        const width = requestBody?.width || 1024;
        const height = requestBody?.height || 768;
        
        await manager.ensureBrowser();
        console.log(`Browser ensured with viewport ${width}x${height}.`);
        await manager.getContext('opera', { width, height });
        console.log('Opera context ensured.');
        await manager.getPage('opera', 'main', { width, height });
        console.log('Opera main page ensured.');
        
        const viewportSize = manager.getViewportSize('opera');
        return NextResponse.json({ 
          success: true, 
          message: `Browser initialized successfully for Opera with viewport ${viewportSize.width}x${viewportSize.height}.`,
          viewport: viewportSize
        });
      }

      case 'cleanup':
        if (manager.isBrowserInitialized()) { // Only cleanup if browser exists
          await manager.closeBrowser();
          console.log('Playwright browser closed via API.');
          return NextResponse.json({ success: true, message: 'Browser closed successfully.' });
        } else {
          console.log('Cleanup requested, but browser was not initialized.');
          return NextResponse.json({ success: true, message: 'Browser not initialized, no cleanup needed.' });
        }

      case 'goto': {
        if (!requestBody?.url) {
          return NextResponse.json({ success: false, message: 'URL is required for goto action.' }, { status: 400 });
        }
        
        // Check if viewport size is specified
        const options = { ...requestBody.options || {} };
        const width = requestBody?.width;
        const height = requestBody?.height;
        const contextId = requestBody?.contextId || 'opera';
        const pageId = requestBody?.pageId || 'main';
        
        if (width || height) {
          await manager.getContext(contextId, { width, height });
          console.log(`Updated viewport size for navigation: ${width || 'default'}x${height || 'default'}`);
        }
        
        await manager.goto(requestBody.url, pageId, options);
        console.log(`Navigated to ${requestBody.url} on page ${pageId} in context ${contextId}`);
        return NextResponse.json({ success: true, message: `Navigated to ${requestBody.url} on page ${pageId}` });
      }

      case 'screenshot': {
        // Extract options from the request body
        const options = requestBody?.options || {};
        const pageId = requestBody?.pageId || 'main';
        const buffer = await manager.screenshot(pageId, options);
        console.log('Screenshot taken for page:', pageId, 'with options:', options);
        
        // Determine mimeType based on options (default to png if not specified)
        const mimeType = options.type === 'jpeg' ? 'image/jpeg' : 'image/png';
        
        const viewportSize = manager.getViewportSize('opera');
        return NextResponse.json({
          success: true,
          message: 'Screenshot captured successfully for page ' + pageId,
          data: buffer.toString('base64'),
          mimeType: mimeType, // Use determined mimeType
          viewport: viewportSize
        });
      }

      case 'getViewportSize': {
        const contextId = requestBody?.contextId || 'opera';
        const viewportSize = manager.getViewportSize(contextId);
        // console.log(`Retrieved viewport size: ${viewportSize.width}x${viewportSize.height} for context ${contextId}`);
        return NextResponse.json({
          success: true,
          message: 'Viewport size retrieved.',
          viewport: viewportSize
        });
      }

      case 'setViewportSize': {
        const width = requestBody?.width;
        const height = requestBody?.height;
        const contextId = requestBody?.contextId || 'opera';
        
        if (!width || !height) {
          return NextResponse.json({ 
            success: false, 
            message: 'Both width and height are required for setViewportSize action.' 
          }, { status: 400 });
        }
        
        await manager.getContext(contextId, { width, height });
        await manager.getPage(contextId, requestBody?.pageId || 'main', { width, height });
        
        const viewportSize = manager.getViewportSize(contextId);
        console.log(`Viewport size set to ${viewportSize.width}x${viewportSize.height} for context ${contextId}`);
        
        return NextResponse.json({
          success: true,
          message: `Viewport size set to ${width}x${height} for context ${contextId}.`,
          viewport: viewportSize
        });
      }

      case 'pressKey':
        if (!requestBody?.key) {
          return NextResponse.json({ success: false, message: 'key is required for pressKey action.' }, { status: 400 });
        }
        const pressKeyPageId = requestBody?.pageId || 'main';
        await manager.pressKey(requestBody.key, pressKeyPageId);
        console.log(`Pressed key: ${requestBody.key} on page ${pressKeyPageId}`);
        return NextResponse.json({ success: true, message: `Pressed key: ${requestBody.key} on page ${pressKeyPageId}` });

      case 'typeText':
        if (requestBody?.text === undefined) { // Allow empty string but not undefined
          return NextResponse.json({ success: false, message: 'text is required for typeText action.' }, { status: 400 });
        }
        const typeTextPageId = requestBody?.pageId || 'main';
        await manager.typeText(requestBody.text, typeTextPageId);
        console.log(`Typed text: ${requestBody.text} on page ${typeTextPageId}`);
        return NextResponse.json({ success: true, message: `Typed text: ${requestBody.text} on page ${typeTextPageId}` });

      // --- Mouse Actions (Using Raw Viewport Coords) --- 
      case 'mouseMove': {
        if (requestBody?.x === undefined || requestBody?.y === undefined) {
          return NextResponse.json({ success: false, message: `x and y coordinates are required for ${action} action.` }, { status: 400 });
        }
        const mouseMovePageId = requestBody?.pageId || 'main';
        await manager.mouseAction('move', requestBody.x, requestBody.y, mouseMovePageId, requestBody?.options || {});
        console.log(`${action} performed at viewport coords (${requestBody.x}, ${requestBody.y}) on page ${mouseMovePageId}`);
        return NextResponse.json({ success: true, message: `${action} performed at (${requestBody.x}, ${requestBody.y}) on page ${mouseMovePageId}` });
      }

      case 'click':
      case 'doubleClick':
      case 'mouseDown':
      case 'mouseUp': {
        if (requestBody?.x === undefined || requestBody?.y === undefined) {
          return NextResponse.json({ success: false, message: `x and y coordinates are required for ${action} action.` }, { status: 400 });
        }

        const button = requestBody?.button || 'left';
        const clickOptions = { ...requestBody?.options, button };
        const x = requestBody.x;
        const y = requestBody.y;
        const mouseActionPageId = requestBody?.pageId || 'main';

        let managerAction: 'click' | 'dblclick' | 'down' | 'up';
        if (action === 'click') managerAction = 'click';
        else if (action === 'doubleClick') managerAction = 'dblclick';
        else if (action === 'mouseDown') managerAction = 'down';
        else managerAction = 'up';

        await manager.mouseAction(managerAction, x, y, mouseActionPageId, clickOptions);
        console.log(`${action} performed at viewport coords (${x}, ${y}) with button ${button} on page ${mouseActionPageId}`);
        return NextResponse.json({ success: true, message: `${action} performed at (${x}, ${y}) on page ${mouseActionPageId}` });
      }

      case 'scroll': {
        if (requestBody?.deltaX === undefined || requestBody?.deltaY === undefined) {
          return NextResponse.json({ success: false, message: `deltaX and deltaY are required for ${action} action.` }, { status: 400 });
        }
        const scrollPageId = requestBody?.pageId || 'main';
        await manager.scroll(requestBody.deltaX, requestBody.deltaY, scrollPageId);
        console.log(`Scrolled by (${requestBody.deltaX}, ${requestBody.deltaY}) on page ${scrollPageId}`);
        return NextResponse.json({ success: true, message: `Scrolled by (${requestBody.deltaX}, ${requestBody.deltaY}) on page ${scrollPageId}` });
      }

      case 'goBack': {
        const goBackPageId = requestBody?.pageId || 'main';
        await manager.goBack(goBackPageId, requestBody?.options || {});
        console.log(`Navigated back on page ${goBackPageId}`);
        return NextResponse.json({ success: true, message: `Navigated back on page ${goBackPageId}` });
      }

      case 'goForward': {
        const goForwardPageId = requestBody?.pageId || 'main';
        await manager.goForward(goForwardPageId, requestBody?.options || {});
        console.log(`Navigated forward on page ${goForwardPageId}`);
        return NextResponse.json({ success: true, message: `Navigated forward on page ${goForwardPageId}` });
      }

      case 'drag': {
        const { startX, startY, endX, endY, button = 'left' } = requestBody || {};
        if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
          return NextResponse.json({ success: false, message: `startX, startY, endX, and endY are required for ${action} action.` }, { status: 400 });
        }
        const dragPageId = requestBody?.pageId || 'main';
        console.log(`Performing drag from (${startX}, ${startY}) to (${endX}, ${endY}) with button ${button} on page ${dragPageId}`);
        await manager.mouseAction('move', startX, startY, dragPageId, { button }); // Move to start
        await manager.mouseAction('down', startX, startY, dragPageId, { button }); // Press button
        await manager.mouseAction('move', endX, endY, dragPageId, { button });   // Drag to end
        await manager.mouseAction('up', endX, endY, dragPageId, { button });     // Release button
        console.log(`Drag completed on page ${dragPageId}`);
        return NextResponse.json({ success: true, message: `Dragged from (${startX}, ${startY}) to (${endX}, ${endY}) on page ${dragPageId}` });
      }

      case 'cursor_position':
        console.warn('Action cursor_position is not supported by Playwright.');
        return NextResponse.json({ success: false, message: 'Action cursor_position is not supported.' }, { status: 400 });

      case 'getCookies': {
        const url = requestBody?.url;
        if (!url) {
          return NextResponse.json({ success: false, message: 'URL is required for getCookies action.' }, { status: 400 });
        }
        const manager = PlaywrightManager.getInstance();
        const contextId = 'opera';
        // Log cookies to console
        await manager.logCookies(contextId, url);
        // Also return cookies in response
        const context = manager['contexts'].get(contextId);
        if (!context) {
          return NextResponse.json({ success: false, message: `Context ${contextId} does not exist.` }, { status: 400 });
        }
        const cookies = await context.cookies(url);
        return NextResponse.json({ success: true, cookies });
      }

      case 'getStatus': {
        const manager = PlaywrightManager.getInstance();
        const status = manager.getStatus();
        // console.log('[Playwright API] getStatus called', status); // Log status server-side
        return NextResponse.json({ success: true, status });
      }

      case 'createPage': {
        const contextId = requestBody?.contextId || 'opera';
        const pageId = requestBody?.pageId || `page-${Date.now()}`;
        const width = requestBody?.width;
        const height = requestBody?.height;
        const url = requestBody?.url;

        await manager.getContext(contextId, { width, height });
        const page = await manager.createPage(contextId, pageId, { width, height });
        console.log(`New page created with ID ${pageId} under context ${contextId}`);
        if (url) {
          await manager.goto(url, pageId, requestBody?.options || {});
          console.log(`Navigated new page ${pageId} to ${url}`);
        }
        const viewportSize = manager.getViewportSize(contextId);
        return NextResponse.json({
          success: true,
          message: `Page ${pageId} created under context ${contextId}${url ? ` and navigated to ${url}` : ''}`,
          pageId,
          contextId,
          viewport: viewportSize
        });
      }

      case 'deletePage': {
        const pageId = requestBody?.pageId;
        const contextId = requestBody?.contextId || 'opera';
        if (!pageId) {
          return NextResponse.json({ success: false, message: 'pageId is required for deletePage action.' }, { status: 400 });
        }
        await manager.deletePage(contextId, pageId);
        console.log(`Deleted page ${pageId} from context ${contextId}`);
        return NextResponse.json({
          success: true,
          message: `Page ${pageId} deleted from context ${contextId}`
        });
      }

      case 'renamePage': {
        const pageId = requestBody?.pageId;
        const newPageId = requestBody?.newPageId;
        const contextId = requestBody?.contextId || 'opera';
        if (!pageId || !newPageId) {
          return NextResponse.json({ success: false, message: 'pageId and newPageId are required for renamePage action.' }, { status: 400 });
        }
        await manager.renamePage(contextId, pageId, newPageId);
        console.log(`Renamed page ${pageId} to ${newPageId} in context ${contextId}`);
        return NextResponse.json({
          success: true,
          message: `Page ${pageId} renamed to ${newPageId} in context ${contextId}`
        });
      }

      default:
        console.log('Invalid action received:', action);
        return NextResponse.json({ success: false, message: 'Invalid action specified.' }, { status: 400 });
    } // End of switch statement

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing playwright action [${action || 'unknown'}]:`, error);
    return NextResponse.json(
      { success: false, message: `Failed to process action ${action || 'unknown'}: ${errorMessage}` },
      { status: 500 }
    );
  } // End of try-catch
} // End of POST function
