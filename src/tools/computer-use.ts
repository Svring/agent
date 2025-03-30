import { anthropic } from '@ai-sdk/anthropic';
import { ScreenshotBase64Response, ScreenSizeResponse } from '@/app/(app)/operator/types';

// Node.js imports for reading config file (will only work server-side)
import fs from 'fs/promises';
import path from 'path';
import * as toml from '@iarna/toml';

interface ServiceConfig {
    name: string;
    port: number;
    base_url: string;
    route_url?: string;
    icon?: string;
    folder_path?: string;
    init_command?: string;
    status?: string; // Keep status for context if needed, but won't be live
    endpoints?: any[]; // Simplified endpoint structure from TOML
}

let operatorConfigCache: ServiceConfig | null | undefined = undefined; // Cache: undefined = not loaded, null = load failed/not found
let screenSizeCache: { width: number; height: number } | null = null; // Cache for screen size

// Function to read and parse the service config TOML file
// This will only work reliably in a Node.js environment (like API routes)
async function getOperatorConfig(): Promise<ServiceConfig | null> {
    if (operatorConfigCache !== undefined) {
        return operatorConfigCache;
    }

    try {
        const configPath = path.join(process.cwd(), 'src', 'config', 'serviceConfig.toml');
        const fileContent = await fs.readFile(configPath, 'utf-8');
        const fullConfig = toml.parse(fileContent);

        // Check if services and operator exist in the parsed config
        if (typeof fullConfig === 'object' && fullConfig !== null && 'services' in fullConfig) {
            const services = fullConfig.services as any;
            if (typeof services === 'object' && services !== null && 'operator' in services) {
                 // Basic validation might be added here if needed
                operatorConfigCache = services.operator as ServiceConfig;
                console.log("Successfully loaded operator config from TOML:", operatorConfigCache?.name, operatorConfigCache?.base_url, operatorConfigCache?.port);
                return operatorConfigCache;
            }
        }
        console.error('Operator configuration not found within serviceConfig.toml');
        operatorConfigCache = null;
        return null;
    } catch (error) {
        console.error('Failed to load or parse serviceConfig.toml:', error);
        operatorConfigCache = null; // Mark as failed
        return null;
    }
}

// New function to fetch screen size from the operator service
async function fetchScreenSize(): Promise<{ width: number; height: number } | null> {
    // Return cached value if available
    if (screenSizeCache) {
        console.log("Returning cached screen size:", screenSizeCache);
        return screenSizeCache;
    }

    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
        console.error("Cannot fetch screen size: Operator config not loaded.");
        return null;
    }

    const endpointPath = '/screen_size';
    const method = 'GET';
    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    console.log(`Fetching screen size from ${method} ${requestUrl}`);

    try {
        const response = await fetch(requestUrl, { method: method });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Screen size request failed: ${response.status} ${response.statusText}. ${errorText}`.trim());
        }

        const data = await response.json() as ScreenSizeResponse;

        // Note: ScreenSizeResponse might not have a 'success' field based on the type definition
        // Rely on HTTP status and data format validation

        if (typeof data.width !== 'number' || typeof data.height !== 'number') {
            throw new Error('Invalid screen size response format from API');
        }

        console.log(`Fetched screen size: ${data.width}x${data.height}`);
        screenSizeCache = { width: data.width, height: data.height }; // Cache the result
        return screenSizeCache;
    } catch (error: any) {
        console.error('Error fetching screen size:', error);
        return null; // Return null on error
    }
}

// New function dedicated to calling the screenshot endpoint
async function callScreenshotEndpoint(): Promise<string> {
    // Get config directly instead of from store
    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
        throw new Error('Operator service configuration could not be loaded.');
    }

    const endpointPath = '/screenshot_base64';
    const method = 'POST';
    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    console.log(`Calling ${method} ${requestUrl}`);

    // Removed endpoint finding logic as we know the path

    const requestBody = {
        format: 'png',
        full_screen: true
    };

    try {
        // Use the constructed URL
        const response = await fetch(requestUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to get error details
            throw new Error(`Screenshot request failed: ${response.status} ${response.statusText}. ${errorData.detail || ''}`.trim());
        }

        const data = await response.json() as ScreenshotBase64Response;
        // Check the success field from the response data as well
        if (data.success === false) {
             // Use a generic message as ScreenshotBase64Response doesn't have a message field
             throw new Error(`Screenshot request reported failure (success: false)`); 
        }
        if (!data || typeof data.base64_image !== 'string' || typeof data.format !== 'string') {
            throw new Error('Invalid screenshot response format from API');
        }
        return `data:image/${data.format};base64,${data.base64_image}`;
    } catch (error: any) {
        console.error('Error capturing screenshot:', error);
        // Rethrow with a more specific message if possible
        throw new Error(`Failed to call screenshot endpoint: ${error.message}`);
    }
}

// Function to execute a computer action - now returns string or image object
async function executeComputerAction(action: string, coordinate: number[] | undefined, text: string | undefined): Promise<string | { type: 'image', data: string }> {
    console.log('Executing computer action (server-side config):', action, 'coordinate:', coordinate, 'text:', text);

    // Handle screenshot action separately
    if (action === 'screenshot') {
        try {
            const base64DataUrl = await callScreenshotEndpoint();
            return {
                type: 'image',
                data: base64DataUrl,
            };
        } catch (error: any) {
            console.error(`Error executing action '${action}':`, error);
            throw new Error(`Failed to execute action '${action}': ${error.message}`);
        }
    }

    // Get config directly for other actions
    const operatorConfig = await getOperatorConfig();
    if (!operatorConfig) {
        throw new Error('Operator service configuration could not be loaded.');
    }

    // Removed store state logging

    let endpointPath: string;
    let method: string = 'POST'; // Default to POST
    let requestBody: object | null = null;

    // Determine endpoint path, method, and body based on action
    switch (action) {
        case 'key':
            endpointPath = '/press_key';
            if (!text) throw new Error(`'text' is required for action: ${action}`);
            requestBody = { key: text };
            break;
        case 'type':
            endpointPath = '/type_text';
            if (!text) throw new Error(`'text' is required for action: ${action}`);
            requestBody = { text: text };
            break;
        case 'mouse_move':
            endpointPath = '/move';
            if (!coordinate || coordinate.length !== 2) throw new Error(`Valid 'coordinate' [x, y] is required for action: ${action}`);
            requestBody = { x: coordinate[0], y: coordinate[1] };
            break;
        case 'left_click':
        case 'right_click':
        case 'middle_click':
            endpointPath = '/click';
            if (!coordinate || coordinate.length !== 2) throw new Error(`Valid 'coordinate' [x, y] is required for action: ${action}`);
            requestBody = { x: coordinate[0], y: coordinate[1], button: action.split('_')[0] }; // Extract 'left', 'right', or 'middle'
            break;
        case 'left_click_drag':
            endpointPath = '/drag';
            if (!coordinate || coordinate.length !== 2) throw new Error(`Valid 'coordinate' [x, y] is required for action: ${action}`);
            requestBody = { x: coordinate[0], y: coordinate[1], button: 'left' };
            break;
        case 'double_click':
            endpointPath = '/double_click';
            if (coordinate && coordinate.length === 2) {
                requestBody = { x: coordinate[0], y: coordinate[1], button: 'left' };
            } else {
                requestBody = { button: 'left' }; // Click at current position if no coords provided
            }
            break;
        case 'cursor_position':
            endpointPath = '/cursor_position';
            method = 'GET'; // This is a GET request
            requestBody = null;
            break;
        default:
            console.warn(`Unknown or unhandled action received in executeComputerAction: ${action}`);
            throw new Error(`Action '${action}' is unknown or not handled.`);
    }

    // Construct the request URL using config data
    const requestUrl = `http://${operatorConfig.base_url}:${operatorConfig.port}${endpointPath}`;
    console.log(`Calling ${method} ${requestUrl}`);

    // Removed endpoint finding logic

    try {
        const response = await fetch(requestUrl, {
            method: method,
            headers: {
                // Only add Content-Type header if there's a body
                ...(requestBody && { 'Content-Type': 'application/json' }),
            },
            // Only add body if it's not null
            ...(requestBody && { body: JSON.stringify(requestBody) }),
        });

        const result = await response.json();

        // Use detailed error message from API if available
        if (!response.ok) {
             throw new Error(`Action '${action}' failed: ${response.status} ${response.statusText}. ${result?.detail || result?.message || ''}`.trim());
        }
        // Also check for success field common in operator responses
         if (result.success === false) {
             throw new Error(`Action '${action}' reported failure: ${result.detail || result.message || 'Unknown error'}`.trim());
         }


        if (action === 'cursor_position') {
            // Ensure x and y are present in the successful response
             if (typeof result.x !== 'number' || typeof result.y !== 'number') {
                 throw new Error(`Action '${action}' succeeded but returned invalid position data.`);
             }
            return `Current cursor position: (${result.x}, ${result.y})`;
        }

        // Return the success message from the API or a default one
        return result.message || `Action '${action}' executed successfully.`;
    } catch (error: any) {
        console.error(`Error executing action '${action}':`, error);
        // Rethrow a slightly cleaner error
        throw new Error(`Failed to execute action '${action}': ${error.message}`);
    }
}

// Tool definition
// NOTE: displayWidthPx and displayHeightPx are static placeholders below.
// The actual screen size can be fetched using the exported fetchScreenSize function
// if needed, but the tool definition itself requires static values here.
export const computerUseTool = anthropic.tools.computer_20241022({
    displayWidthPx: 1470, // Placeholder - Actual size fetched by fetchScreenSize()
    displayHeightPx: 956, // Placeholder - Actual size fetched by fetchScreenSize()
    execute: async ({ action, coordinate, text }) => {
        // All actions are now handled by executeComputerAction using direct config loading
        // If any specific action *needed* the screen size, it could call fetchScreenSize() here.
        return await executeComputerAction(action, coordinate, text);
    },
    experimental_toToolResultContent(result) {
        // This part remains the same, handling the output format
        return typeof result === 'string'
            ? [{ type: 'text', text: result }]
            : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
    },
});

// Export the fetch function separately if needed elsewhere
export { fetchScreenSize };