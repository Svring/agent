'use client'

import React, { useState } from 'react';
import { useServiceStore } from '@/store/service/serviceStore';
import { getEndpointUrl } from '@/models/service/serviceModel';

// Types for the Ollama service responses
interface GenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context: number[];
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}

export default function OllamaPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('Why is the sky blue?');
  const [model, setModel] = useState<string>('qwen2.5:1.5b');
  const [format, setFormat] = useState<string>('json');
  const [stream, setStream] = useState<boolean>(false);

  // Get the ollama service from the store
  const ollamaService = useServiceStore(state => state.getService('ollama'));

  // Handle text generation
  const handleGenerate = async () => {
    if (!ollamaService) {
      setError('Service not available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get the generate endpoint
      const generateEndpoint = ollamaService.endpoints.find(
        endpoint => endpoint.path === '/api/generate' && endpoint.method === 'POST'
      );

      if (!generateEndpoint) {
        throw new Error('Generate endpoint not found');
      }

      // Use Tauri's fetch which bypasses CORS
      const response = await fetch(getEndpointUrl(ollamaService, generateEndpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          model, 
          prompt,
          format,
          stream
        }),
      });

      const data = await response.json() as GenerateResponse;
      setGenerateResult(data.response);
      console.log('Generate successful:', data);
    } catch (err) {
      console.error('Generate error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col p-6 h-full overflow-y-auto">
      <h1 className="text-xl font-bold text-white mb-6">Ollama Service</h1>
      
      {/* Service Status */}
      <div className="bg-gray-700 rounded-lg p-4 shadow mb-4">
        <h2 className="text-lg font-semibold text-white mb-3">Generate Text</h2>
        
        {/* Prompt Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Prompt
          </label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
          />
        </div>

        {/* Model Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Model
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
          />
        </div>

        {/* Format Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Format
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
          >
            <option value="json">JSON</option>
          </select>
        </div>

        {/* Stream Option */}
        <div className="mb-4">
          <label className="flex items-center text-sm font-medium text-gray-300">
            <input
              type="checkbox"
              checked={stream}
              onChange={(e) => setStream(e.target.checked)}
              className="mr-2"
            />
            Stream
          </label>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Generating...' : 'Generate Text'}
        </button>

        {/* Error Message */}
        {error && (
          <div className="mt-3 p-3 bg-red-900/50 text-red-200 rounded">
            <p>{error}</p>
          </div>
        )}

        {/* Generate Result */}
        {generateResult && (
          <div className="mt-4">
            <h3 className="text-md font-medium text-gray-300 mb-2">Generate Result</h3>
            <p className="bg-gray-800 p-3 rounded text-white overflow-auto">
              {generateResult}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 