import { create } from 'zustand';
import { Provider, ProviderModel } from '../../models/provider/providerModel';

interface ProviderStore {
    providers: {
        [key: string]: Provider;
    };
    
    selectedProvider: string | null;
    selectedLLMModel: string | null;
    selectedEmbeddingModel: string | null;
    
    getProvider: (providerName: string) => Provider | undefined;
    updateProviderStatus: (providerName: string, status: Provider['status']) => void;
    setSelectedProvider: (providerName: string | null) => void;
    setSelectedLLMModel: (modelName: string | null) => void;
    setSelectedEmbeddingModel: (modelName: string | null) => void;
    loadProviderConfig: () => Promise<void>;
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
    providers: {},
    selectedProvider: null,
    selectedLLMModel: null,
    selectedEmbeddingModel: null,

    getProvider: (providerName: string) => {
        return get().providers[providerName];
    },

    updateProviderStatus: (providerName: string, status: 'active' | 'inactive') => {
        set((state) => ({
            providers: {
                ...state.providers,
                [providerName]: {
                    ...state.providers[providerName],
                    status
                }
            }
        }));
    },

    setSelectedProvider: (providerName: string | null) => {
        set({ selectedProvider: providerName });
    },
    
    setSelectedLLMModel: (modelName: string | null) => {
        set({ selectedLLMModel: modelName });
    },
    
    setSelectedEmbeddingModel: (modelName: string | null) => {
        set({ selectedEmbeddingModel: modelName });
    },

    loadProviderConfig: async () => {
        try {
            const response = await fetch('/api/provider_config');
            if (!response.ok) {
                throw new Error('Failed to load provider configuration');
            }
            const config = await response.json();
            const providers = parseProviderConfig(config);
            
            // Set default models if available
            const firstProvider = Object.values(providers)[0];
            if (firstProvider) {
                const defaultLLM = firstProvider.models.find(model => model.category === 'llm')?.name || null;
                const defaultEmbedding = firstProvider.models.find(model => model.category === 'embedding')?.name || null;
                
                set({ 
                    providers,
                    selectedProvider: firstProvider.providerName,
                    selectedLLMModel: defaultLLM,
                    selectedEmbeddingModel: defaultEmbedding
                });
            } else {
                set({ providers });
            }
        } catch (error) {
            console.error('Failed to load provider configuration:', error);
        }
    }
}));

function parseProviderConfig(config: any): { [key: string]: Provider } {
    const providers: { [key: string]: Provider } = {};
    
    // Parse each provider from the config object
    for (const [providerName, providerConfig] of Object.entries(config)) {
        const config = providerConfig as any;
        
        // Create models for each provider
        const models: ProviderModel[] = [];
        
        // Add LLM models
        if (Array.isArray(config.llm_models)) {
            config.llm_models.forEach((modelName: string) => {
                models.push({
                    name: modelName,
                    category: 'llm'
                });
            });
        }
        
        // Add Embedding models
        if (Array.isArray(config.embedding_models)) {
            config.embedding_models.forEach((modelName: string) => {
                models.push({
                    name: modelName,
                    category: 'embedding'
                });
            });
        }
        
        // Determine status based on API key presence
        const status = config.api_key ? 'active' : 'inactive';
        
        providers[providerName] = {
            providerName,
            apiKey: config.api_key || '',
            models,
            status
        };
    }
    
    return providers;
}
