import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface ModelOption {
  key: string;
  label: string;
}

export interface ToolOption {
  key: string;
  label: string;
}

interface CastingData {
  models: ModelOption[];
  tools: ToolOption[];
}

const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219'; // Default model from page.tsx
const DEFAULT_TOOLS = ['terminal', 'coder']; // Default tools from page.tsx

export function useChatSettings() {
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [selectedTools, setSelectedTools] = useState<string[]>(DEFAULT_TOOLS);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [availableTools, setAvailableTools] = useState<ToolOption[]>([]);

  const { data: castingData, error: castingError } = useSWR<CastingData>('/api/casting', fetcher);

  useEffect(() => {
    if (castingData) {
      setAvailableModels(castingData.models || []);
      setAvailableTools(castingData.tools || []);

      // Set a default model if current selectedModel is not in the available list or if it's the initial default
      // and a more preferred default (like grok-3-latest) is available.
      const currentModelExists = castingData.models?.some(m => m.key === selectedModel);
      if (!currentModelExists || selectedModel === DEFAULT_MODEL) {
        const grokModel = castingData.models?.find((m) => m.key === 'grok-3-latest');
        if (grokModel) {
          setSelectedModel(grokModel.key);
        } else if (castingData.models && castingData.models.length > 0 && !currentModelExists) {
          // If current selectedModel is not found, and grok isn't there, pick the first available
          setSelectedModel(castingData.models[0].key);
        }
        // If selectedModel is already DEFAULT_MODEL and it exists, this logic won't change it unless grok is preferred.
      }

      // Future: Could add similar logic for selectedTools if needed, e.g., ensuring selected tools are valid.

    } else if (castingError) {
      console.error('[useChatSettings] Error fetching casting options:', castingError);
      // Fallback to empty or keep existing defaults if API fails
      setAvailableModels([]);
      setAvailableTools([]);
    }
  }, [castingData, castingError, selectedModel]); // Added selectedModel to dependency array to re-evaluate default if it changes

  const handleModelChange = (modelKey: string) => {
    setSelectedModel(modelKey);
  };

  // setSelectedTools is directly used by MultiSelect, so we expose it.
  // If more complex logic were needed for tool selection, we could wrap it here.

  return {
    selectedModel,
    setSelectedModel, // Exposing this directly as well for flexibility or if needed by consumers
    selectedTools,
    setSelectedTools,
    availableModels,
    availableTools,
    handleModelChange,
    isLoadingSettings: !castingData && !castingError,
    settingsError: castingError,
  };
} 