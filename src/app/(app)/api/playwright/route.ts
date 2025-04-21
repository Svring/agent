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
  'scroll' | 'drag' | 'getViewportSize' | 'setViewportSize' | 'goBack' | 'goForward' | 'getCookies'; // Added navigation actions
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

    console.log(`Received playwright request with action: ${action}`);

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
          await manager.closeContext('opera');
          console.log('Playwright Opera context closed via API.');
          return NextResponse.json({ success: true, message: 'Opera context closed successfully.' });
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
        
        if (width || height) {
          await manager.getPage('opera', 'main', { width, height });
          console.log(`Updated viewport size for navigation: ${width || 'default'}x${height || 'default'}`);
        }
        
        await manager.goto(requestBody.url, 'main', options);
        console.log(`Navigated to ${requestBody.url}`);
        return NextResponse.json({ success: true, message: `Navigated to ${requestBody.url}` });
      }

      case 'screenshot':
        const buffer = await manager.screenshot('main', requestBody?.options || {});
        console.log('Screenshot taken.');
        const viewportSize = manager.getViewportSize('opera');
        return NextResponse.json({
          success: true,
          message: 'Screenshot captured successfully.',
          data: buffer.toString('base64'),
          viewport: viewportSize
        });

      case 'getViewportSize': {
        const viewportSize = manager.getViewportSize('opera');
        console.log(`Retrieved viewport size: ${viewportSize.width}x${viewportSize.height}`);
        return NextResponse.json({
          success: true,
          message: 'Viewport size retrieved.',
          viewport: viewportSize
        });
      }

      case 'setViewportSize': {
        const width = requestBody?.width;
        const height = requestBody?.height;
        
        if (!width || !height) {
          return NextResponse.json({ 
            success: false, 
            message: 'Both width and height are required for setViewportSize action.' 
          }, { status: 400 });
        }
        
        await manager.getContext('opera', { width, height });
        await manager.getPage('opera', 'main', { width, height });
        
        const viewportSize = manager.getViewportSize('opera');
        console.log(`Viewport size set to ${viewportSize.width}x${viewportSize.height}`);
        
        return NextResponse.json({
          success: true,
          message: `Viewport size set to ${width}x${height}.`,
          viewport: viewportSize
        });
      }

      case 'pressKey':
        if (!requestBody?.key) {
          return NextResponse.json({ success: false, message: 'key is required for pressKey action.' }, { status: 400 });
        }
        await manager.pressKey(requestBody.key, 'main');
        console.log(`Pressed key: ${requestBody.key}`);
        return NextResponse.json({ success: true, message: `Pressed key: ${requestBody.key}` });

      case 'typeText':
        if (requestBody?.text === undefined) { // Allow empty string but not undefined
          return NextResponse.json({ success: false, message: 'text is required for typeText action.' }, { status: 400 });
        }
        await manager.typeText(requestBody.text, 'main');
        console.log(`Typed text: ${requestBody.text}`);
        return NextResponse.json({ success: true, message: `Typed text: ${requestBody.text}` });

      // --- Mouse Actions (Using Raw Viewport Coords) --- 
      case 'mouseMove': {
        if (requestBody?.x === undefined || requestBody?.y === undefined) {
          return NextResponse.json({ success: false, message: `x and y coordinates are required for ${action} action.` }, { status: 400 });
        }
        await manager.mouseAction('move', requestBody.x, requestBody.y, 'main', requestBody?.options || {});
        console.log(`${action} performed at viewport coords (${requestBody.x}, ${requestBody.y})`);
        return NextResponse.json({ success: true, message: `${action} performed at (${requestBody.x}, ${requestBody.y})` });
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

        let managerAction: 'click' | 'dblclick' | 'down' | 'up';
        if (action === 'click') managerAction = 'click';
        else if (action === 'doubleClick') managerAction = 'dblclick';
        else if (action === 'mouseDown') managerAction = 'down';
        else managerAction = 'up';

        await manager.mouseAction(managerAction, x, y, 'main', clickOptions);
        console.log(`${action} performed at viewport coords (${x}, ${y}) with button ${button}`);
        return NextResponse.json({ success: true, message: `${action} performed at (${x}, ${y})` });
      }

      case 'scroll': {
        if (requestBody?.deltaX === undefined || requestBody?.deltaY === undefined) {
          return NextResponse.json({ success: false, message: `deltaX and deltaY are required for ${action} action.` }, { status: 400 });
        }
        await manager.scroll(requestBody.deltaX, requestBody.deltaY, 'main');
        console.log(`Scrolled by (${requestBody.deltaX}, ${requestBody.deltaY})`);
        return NextResponse.json({ success: true, message: `Scrolled by (${requestBody.deltaX}, ${requestBody.deltaY})` });
      }

      case 'goBack': {
        await manager.goBack('main', requestBody?.options || {});
        console.log(`Navigated back`);
        return NextResponse.json({ success: true, message: `Navigated back` });
      }

      case 'goForward': {
        await manager.goForward('main', requestBody?.options || {});
        console.log(`Navigated forward`);
        return NextResponse.json({ success: true, message: `Navigated forward` });
      }

      case 'drag': {
        const { startX, startY, endX, endY, button = 'left' } = requestBody || {};
        if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
          return NextResponse.json({ success: false, message: `startX, startY, endX, and endY are required for ${action} action.` }, { status: 400 });
        }
        console.log(`Performing drag from (${startX}, ${startY}) to (${endX}, ${endY}) with button ${button}`);
        await manager.mouseAction('move', startX, startY, 'main', { button }); // Move to start
        await manager.mouseAction('down', startX, startY, 'main', { button }); // Press button
        await manager.mouseAction('move', endX, endY, 'main', { button });   // Drag to end
        await manager.mouseAction('up', endX, endY, 'main', { button });     // Release button
        console.log(`Drag completed`);
        return NextResponse.json({ success: true, message: `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})` });
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

      default:
        console.log(`Invalid action received: ${action}`);
        return NextResponse.json({ success: false, message: `Invalid action specified.` }, { status: 400 });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing playwright action [${action || 'unknown'}]:`, error);
    return NextResponse.json(
      { success: false, message: `Failed to process action ${action || 'unknown'}: ${errorMessage}` },
      { status: 500 }
    );
  }
} 