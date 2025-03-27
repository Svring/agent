// Types for HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Interface for endpoint input/output types
export type EndpointDataTypes = {
    input?: any;  // Type of the request payload
    output: any;  // Type of the response
}

// Interface for a single endpoint definition
export type ServiceEndpoint = {
    path: string;           // The endpoint path (e.g., "/users")
    method: HttpMethod;     // HTTP method
    dataTypes: EndpointDataTypes;  // Input/output type definitions
    description?: string;   // Optional description of what the endpoint does
}

// Main service model interface
export type LocalService = {
    serviceName: string;    // Name of the service
    port: number;          // Port number the service runs on
    baseUrl: string;       // Base URL (e.g., http://localhost:port)
    routeUrl?: string;     // Route URL for the service in the application
    icon?: string;         // Icon to display for the service
    endpoints: ServiceEndpoint[];  // List of available endpoints
    status: 'inactive' | 'faulty' | 'online';  // Current status of the service
    folderPath: string;    // Path to the service folder
    initiationCommand: string; // Command to start the service
}

// Helper function to create the full URL for an endpoint
export function getEndpointUrl(service: LocalService, endpoint: ServiceEndpoint): string {
    return `http://${service.baseUrl}:${service.port}${endpoint.path}`;
}

// Helper function to create a new service instance
export function createLocalService(
    serviceName: string,
    port: number,
    endpoints: ServiceEndpoint[],
    baseUrl?: string,
    routeUrl?: string,
    icon?: string,
    folderPath?: string,
    initiationCommand?: string
): LocalService {
    return {
        serviceName,
        port,
        baseUrl: baseUrl || `localhost`,
        routeUrl,
        icon,
        endpoints,
        status: 'inactive',
        folderPath: folderPath || `./${serviceName}`,
        initiationCommand: initiationCommand || `python -m app`
    };
}
