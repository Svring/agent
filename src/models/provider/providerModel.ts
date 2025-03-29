// Types for model categories
export type ModelCategory = 'llm' | 'embedding';

// Interface for a single model definition
export type ProviderModel = {
    name: string;          // Name of the model
    category: ModelCategory; // Type of model (LLM, embedding, etc.)
}

// Main provider interface
export type Provider = {
    providerName: string;   // Name of the provider (e.g., "openai", "anthropic")
    apiKey: string;        // API key for the provider
    icon?: string;         // Icon to display for the provider
    models: ProviderModel[]; // List of available models
    status: 'active' | 'inactive'; // Current status of the provider
}

// Helper function to create a model instance
export function createProviderModel(
    name: string,
    category: ModelCategory
): ProviderModel {
    return {
        name,
        category
    };
}

// Helper function to create a new provider instance
export function createProvider(
    providerName: string,
    apiKey: string,
    models: ProviderModel[],
    icon?: string
): Provider {
    return {
        providerName,
        apiKey,
        models,
        icon,
        status: apiKey ? 'active' : 'inactive'
    };
}
