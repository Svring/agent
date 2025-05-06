'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';

interface MiniIndexerProps {
  className?: string;
}

interface ApiStatusResponse {
  status: string; // 'Connected' | 'Disconnected'
  url: string;
}

interface ApiTestResponse {
  message: string;
  collections?: string[];
}

// SWR fetcher for status
const fetcher = async (url: string): Promise<ApiStatusResponse> => {
  const response = await axios.get(url);
  return response.data;
};

export const MiniIndexer: React.FC<MiniIndexerProps> = ({ className }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'loading' | 'connected' | 'disconnected' | 'error'>('idle');
  const [qdrantUrl, setQdrantUrl] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [collections, setCollections] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Use SWR for fetching connection status with automatic revalidation
  const { data: statusData, error: statusError, mutate: refreshStatus } = useSWR('/api/index', fetcher, {
    refreshInterval: 10000, // Check status every 10 seconds
    revalidateOnFocus: true,
    dedupingInterval: 5000,
    onSuccess: (data) => {
      console.log("SWR Status Success:", data);
      setApiStatus(data.status === 'Connected' ? 'connected' : 'disconnected');
      setQdrantUrl(data.url);
      setMessage(''); // Clear message on successful status fetch
    },
    onError: (err) => {
      console.error("SWR Status Error:", err);
      setApiStatus('error');
      setMessage('Failed to fetch Qdrant status.');
    }
  });

  useEffect(() => {
    setIsMounted(true);
    // Initial status might be loading from SWR
    if (!statusData && !statusError) {
      setApiStatus('loading');
  }
  }, [statusData, statusError]);

  // Handler to test connection
  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setMessage('Testing Qdrant connection...');
    setCollections([]);
    try {
      const response = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testConnection' }),
      });
      const data: ApiTestResponse = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Connection test successful!');
        setCollections(data.collections || []);
        // Refresh SWR status as the connection state might have changed
        await refreshStatus();
      } else {
        setMessage(data.message || 'Connection test failed.');
        setApiStatus('error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setMessage(`Connection test request failed: ${errorMsg}`);
      console.error('Error calling /api/index testConnection:', error);
      setApiStatus('error');
    } finally {
      setIsTesting(false);
    }
  }, [refreshStatus]);

  // Helper to determine badge variant based on status
  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (apiStatus) {
      case 'connected': return 'default';
      case 'disconnected': return 'destructive';
      case 'loading':
      case 'idle': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (): string => {
    switch (apiStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'loading': return 'Loading...';
      case 'idle': return 'Idle';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  }

  return (
    <div className={`flex flex-col p-4 border rounded-lg shadow-sm bg-card text-card-foreground ${className || ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Qdrant Index Manager</h3>
        <Badge 
          variant={getStatusVariant()}
          className={apiStatus === 'connected' ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}
        >
          {getStatusText()}
        </Badge>
      </div>

      <div className="mb-3 space-y-1 text-sm">
        <p>
          <span className="font-medium">URL:</span>{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">{qdrantUrl || 'Loading...'}</code>
        </p>
        {message && (
          <p className={`text-xs ${apiStatus === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}>
            {message}
          </p>
        )}
      </div>

      <Button
        onClick={handleTestConnection}
        disabled={isTesting || apiStatus === 'loading'}
        size="sm"
        variant="outline"
      >
        {isTesting ? 'Testing...' : 'Test Connection'}
      </Button>

      {collections.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <h4 className="text-sm font-medium mb-2">Detected Collections:</h4>
          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            {collections.map((col) => (
              <li key={col}>{col}</li>
            ))}
          </ul>
        </div>
      )}
      {!isTesting && apiStatus === 'connected' && collections.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground border-t pt-3">No collections found.</p>
      )}
    </div>
  );
};

export default MiniIndexer;