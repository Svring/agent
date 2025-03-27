'use client'

import React from 'react';
import { useServiceStore } from '@/store/service/serviceStore';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface OutputDisplayProps {
  timestamp: number;
  data: any;
  error?: string;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ timestamp, data, error }) => {
  const date = new Date(timestamp);
  const formattedTime = date.toLocaleTimeString();

  return (
    <div className="border border-border rounded-lg p-3 mb-2 bg-muted/50">
      <div className="text-xs text-muted-foreground mb-2">{formattedTime}</div>
      {error ? (
        <div className="text-destructive">{error}</div>
      ) : (
        <pre className="text-sm text-foreground/80 whitespace-pre-wrap overflow-auto max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default function DockPage() {
  const services = useServiceStore(state => state.services);
  const getEndpointOutputs = useServiceStore(state => state.getEndpointOutputs);
  const clearEndpointOutputs = useServiceStore(state => state.clearEndpointOutputs);

  // Function to get all outputs for a service
  const getServiceOutputs = (serviceName: string) => {
    const service = services[serviceName];
    if (!service) return {};

    return service.endpoints.reduce((acc, endpoint) => {
      acc[endpoint.path] = getEndpointOutputs(serviceName, endpoint.path);
      return acc;
    }, {} as { [key: string]: any[] });
  };

  // Function to handle clearing outputs
  const handleClearOutputs = (serviceName: string, endpointPath?: string) => {
    clearEndpointOutputs(serviceName, endpointPath);
  };

  // Get all service names
  const serviceNames = Object.keys(services);
  
  // Active service state
  const [activeService, setActiveService] = React.useState<string>(serviceNames[0] || 'omniparser');

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg bg-background">
      <div className="text-2xl font-bold p-4 border-b border-border">
        Service Outputs
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Service Tabs */}
        <div className="flex border-b border-border">
          {serviceNames.map(serviceName => (
            <button 
              key={serviceName} 
              className={`px-4 py-2 cursor-pointer hover:bg-muted transition-colors ${
                activeService === serviceName 
                  ? 'border-b-2 border-primary text-primary font-medium' 
                  : 'text-muted-foreground'
              }`}
              onClick={() => setActiveService(serviceName)}
            >
              {serviceName}
            </button>
          ))}
        </div>
        
        {/* Service Output Sections */}
        <div className="p-4 flex flex-wrap gap-4">
          {/* Omniparser Section */}
          {activeService === 'omniparser' && (
            <div className="w-full bg-card rounded-lg p-4 shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Omniparser</h2>
                <Button
                  onClick={() => handleClearOutputs('omniparser')}
                  variant="destructive"
                  size="sm"
                >
                  Clear All
                </Button>
              </div>
              {Object.entries(getServiceOutputs('omniparser')).map(([path, outputs]) => (
                <div key={path} className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{path}</h3>
                    <Button
                      onClick={() => handleClearOutputs('omniparser', path)}
                      variant="outline"
                      size="sm"
                    >
                      Clear
                    </Button>
                  </div>
                  {outputs.length > 0 ? (
                    outputs.map((output, index) => (
                      <OutputDisplay
                        key={index}
                        timestamp={output.timestamp}
                        data={output.data}
                        error={output.error}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No outputs yet</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Operator Section */}
          {activeService === 'operator' && (
            <div className="w-full bg-card rounded-lg p-4 shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Operator</h2>
                <Button
                  onClick={() => handleClearOutputs('operator')}
                  variant="destructive"
                  size="sm"
                >
                  Clear All
                </Button>
              </div>
              {Object.entries(getServiceOutputs('operator')).map(([path, outputs]) => (
                <div key={path} className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{path}</h3>
                    <Button
                      onClick={() => handleClearOutputs('operator', path)}
                      variant="outline"
                      size="sm"
                    >
                      Clear
                    </Button>
                  </div>
                  {outputs.length > 0 ? (
                    outputs.map((output, index) => (
                      <OutputDisplay
                        key={index}
                        timestamp={output.timestamp}
                        data={output.data}
                        error={output.error}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No outputs yet</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Ollama Section */}
          {activeService === 'ollama' && (
            <div className="w-full bg-card rounded-lg p-4 shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Ollama</h2>
                <Button
                  onClick={() => handleClearOutputs('ollama')}
                  variant="destructive"
                  size="sm"
                >
                  Clear All
                </Button>
              </div>
              {Object.entries(getServiceOutputs('ollama')).map(([path, outputs]) => (
                <div key={path} className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{path}</h3>
                    <Button
                      onClick={() => handleClearOutputs('ollama', path)}
                      variant="outline"
                      size="sm"
                    >
                      Clear
                    </Button>
                  </div>
                  {outputs.length > 0 ? (
                    outputs.map((output, index) => (
                      <OutputDisplay
                        key={index}
                        timestamp={output.timestamp}
                        data={output.data}
                        error={output.error}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No outputs yet</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 