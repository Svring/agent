import { create } from 'zustand';
import { LocalService } from '../../models/service/serviceModel';

// Type to represent the output of any endpoint
interface EndpointOutput {
    timestamp: number;
    data: any;
    error?: string;
}

// Type to represent outputs for all endpoints of a service
interface ServiceEndpointOutputs {
    [endpointPath: string]: EndpointOutput[];
}

interface ServiceStore {
    services: {
        [key: string]: LocalService;
    };
    
    // Track outputs for each service's endpoints
    serviceOutput: {
        [serviceName: string]: ServiceEndpointOutputs;
    };
    
    selectedService: string | null;
    getService: (serviceName: string) => LocalService | undefined;
    updateServiceStatus: (serviceName: string, status: LocalService['status']) => void;
    setSelectedService: (serviceName: string | null) => void;
    loadServiceConfig: () => Promise<void>;
    
    // New functions to manage endpoint outputs
    addEndpointOutput: (serviceName: string, endpointPath: string, output: any, error?: string) => void;
    getEndpointOutputs: (serviceName: string, endpointPath: string) => EndpointOutput[];
    clearEndpointOutputs: (serviceName: string, endpointPath?: string) => void;
}

export const useServiceStore = create<ServiceStore>((set, get) => ({
    services: {},
    serviceOutput: {},
    selectedService: null,

    getService: (serviceName: string) => {
        return get().services[serviceName];
    },

    updateServiceStatus: (serviceName: string, status: 'inactive' | 'faulty' | 'online') => {
        set((state) => ({
            services: {
                ...state.services,
                [serviceName]: {
                    ...state.services[serviceName],
                    status
                }
            }
        }));
    },

    setSelectedService: (serviceName: string | null) => {
        set({ selectedService: serviceName });
    },

    loadServiceConfig: async () => {
        try {
            const response = await fetch('/api/service_config');
            if (!response.ok) {
                throw new Error('Failed to load service configuration');
            }
            const config = await response.json();
            const services = parseServiceConfig(config);
            set({ services });
        } catch (error) {
            console.error('Failed to load service configuration:', error);
        }
    },

    // Add new output for a service endpoint
    addEndpointOutput: (serviceName: string, endpointPath: string, output: any, error?: string) => {
        set((state) => {
            const currentServiceOutputs = state.serviceOutput[serviceName] || {};
            const currentEndpointOutputs = currentServiceOutputs[endpointPath] || [];

            return {
                serviceOutput: {
                    ...state.serviceOutput,
                    [serviceName]: {
                        ...currentServiceOutputs,
                        [endpointPath]: [
                            ...currentEndpointOutputs,
                            {
                                timestamp: Date.now(),
                                data: output,
                                ...(error && { error })
                            }
                        ]
                    }
                }
            };
        });
    },

    // Get outputs for a specific endpoint
    getEndpointOutputs: (serviceName: string, endpointPath: string) => {
        const state = get();
        return state.serviceOutput[serviceName]?.[endpointPath] || [];
    },

    // Clear outputs for a service or specific endpoint
    clearEndpointOutputs: (serviceName: string, endpointPath?: string) => {
        set((state) => {
            if (!endpointPath) {
                // Clear all outputs for the service
                const { [serviceName]: _, ...remainingServices } = state.serviceOutput;
                return { serviceOutput: remainingServices };
            }

            // Clear outputs for specific endpoint
            const serviceOutputs = state.serviceOutput[serviceName];
            if (!serviceOutputs) return state;

            const { [endpointPath]: __, ...remainingEndpoints } = serviceOutputs;
            return {
                serviceOutput: {
                    ...state.serviceOutput,
                    [serviceName]: remainingEndpoints
                }
            };
        });
    }
}));

function parseServiceConfig(config: any): { [key: string]: LocalService } {
    const services: { [key: string]: LocalService } = {};
    
    // The config has a top-level 'services' key
    const servicesConfig = config.services;
    
    // Parse each service from the services object
    for (const [_, serviceConfig] of Object.entries(servicesConfig)) {
        const config = serviceConfig as any;
        
        // Map status values from config to our new status types
        let status: 'inactive' | 'faulty' | 'online' = 'inactive';
        if (config.status === 'running') {
            status = 'online';
        } else if (config.status === 'error') {
            status = 'faulty';
        }
        
        services[config.name] = {
            serviceName: config.name,
            port: config.port,
            baseUrl: config.base_url,
            routeUrl: config.route_url,
            icon: config.icon,
            endpoints: parseEndpoints(config.endpoints || []),
            status: status,
            folderPath: config.folder_path || '',
            initiationCommand: config.init_command || ''
        };
    }
    
    return services;
}

function parseEndpoints(endpoints: any[]): LocalService['endpoints'] {
    return endpoints.map(endpoint => ({
        path: endpoint.path,
        method: endpoint.method,
        dataTypes: {
            input: endpoint.data_types?.input,
            output: endpoint.data_types?.output
        },
        description: endpoint.desc
    }));
}
