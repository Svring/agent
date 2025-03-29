'use client'

import React, { useState, useEffect } from 'react';
import { useServiceStore } from '@/store/service/serviceStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';

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
  
  // Track which endpoints have expanded outputs
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});

  // Toggle expanded state for an endpoint
  const toggleExpanded = (serviceName: string, path: string) => {
    const key = `${serviceName}-${path}`;
    setExpandedEndpoints(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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
  const [activeService, setActiveService] = useState<string>(serviceNames[0] || 'omniparser');

  // Get selected service
  const selectedService = services[activeService];

  // Get outputs to display (all or limited to 3)
  const getDisplayedOutputs = (outputs: any[], serviceName: string, path: string) => {
    const key = `${serviceName}-${path}`;
    const isExpanded = expandedEndpoints[key];
    
    if (outputs.length <= 3 || isExpanded) {
      return outputs;
    }
    
    // Return only the 3 most recent outputs (which are usually at the end of the array)
    return outputs.slice(outputs.length - 3);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-6 px-4 pb-4 w-full">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold">Service Outputs</h1>

        {/* Service Info */}
        {selectedService && (
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span className="font-mono">{selectedService.baseUrl}:{selectedService.port}</span>
            <span>•</span>
            <div className="flex items-center space-x-1">
              <div className={`w-1.5 h-1.5 rounded-full ${
                selectedService.status === 'online' ? 'bg-green-500' :
                selectedService.status === 'inactive' ? 'bg-muted' : 'bg-destructive'
              }`}></div>
              <span className="capitalize">{selectedService.status || 'unknown'}</span>
            </div>
          </div>
        )}

        {/* Service Description */}
        <div className="mt-2 text-sm text-muted-foreground">
          <p>
            This dashboard shows all outputs from service endpoints. 
            You can view recent API calls, responses, and errors for each service.
          </p>
        </div>
      </div>

      <Tabs 
        defaultValue={serviceNames[0] || 'omniparser'} 
        value={activeService}
        onValueChange={setActiveService}
        className="w-full flex-1"
      >
        <TabsList className='grid w-full' style={{ gridTemplateColumns: `repeat(${serviceNames.length}, 1fr)` }}>
          {serviceNames.map(serviceName => (
            <TabsTrigger key={serviceName} value={serviceName}>
              {serviceName}
            </TabsTrigger>
          ))}
        </TabsList>

        {serviceNames.map(serviceName => (
          <TabsContent key={serviceName} value={serviceName} className="flex flex-col space-y-4 mt-4">
            <Card className="flex flex-col flex-1 w-full">
              <CardHeader className="flex-none flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="capitalize">{serviceName}</CardTitle>
                  <CardDescription>Endpoint outputs and responses</CardDescription>
                </div>
                <Button
                  onClick={() => handleClearOutputs(serviceName)}
                  variant="destructive"
                  size="sm"
                >
                  Clear All
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {Object.entries(getServiceOutputs(serviceName)).map(([path, outputs]) => {
                  const key = `${serviceName}-${path}`;
                  const isExpanded = expandedEndpoints[key];
                  const displayedOutputs = getDisplayedOutputs(outputs, serviceName, path);
                  const hasMoreOutputs = outputs.length > 3;
                  
                  return (
                    <div key={path} className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium">{path}</h3>
                        <div className="flex gap-2">
                          {hasMoreOutputs && (
                            <Button
                              onClick={() => toggleExpanded(serviceName, path)}
                              variant="outline"
                              size="sm"
                            >
                              {isExpanded ? "Show Less" : `Show All (${outputs.length})`}
                            </Button>
                          )}
                          <Button
                            onClick={() => handleClearOutputs(serviceName, path)}
                            variant="outline"
                            size="sm"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      {outputs.length > 0 ? (
                        <>
                          {!isExpanded && hasMoreOutputs && (
                            <div className="text-xs text-muted-foreground mb-2">
                              Showing {displayedOutputs.length} of {outputs.length} outputs
                            </div>
                          )}
                          {displayedOutputs.map((output, index) => (
                            <OutputDisplay
                              key={index}
                              timestamp={output.timestamp}
                              data={output.data}
                              error={output.error}
                            />
                          ))}
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground italic py-2">No outputs yet</div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
} 