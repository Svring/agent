'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useServiceStore } from '@/store/service/serviceStore';
import { getEndpointUrl } from '@/models/service/serviceModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Types for the Omniparser service responses
interface ProbeResponse {
  message: string;
}

interface ParseResponse {
  parsed_image_base64: string;
  parsed_content_list: any[];
}

export default function OmniparserPage() {
  // Parse endpoint states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the omniparser service and store functions
  const omniparserService = useServiceStore(state => state.getService('omniparser'));
  const updateServiceStatus = useServiceStore(state => state.updateServiceStatus);
  const addEndpointOutput = useServiceStore(state => state.addEndpointOutput);
  const getEndpointOutputs = useServiceStore(state => state.getEndpointOutputs);

  // Check service status periodically
  useEffect(() => {
    const checkServiceStatus = async () => {
      if (!omniparserService) return;

      try {
        const probeEndpoint = omniparserService.endpoints.find(
          endpoint => endpoint.path === '/probe/' && endpoint.method === 'GET'
        );

        if (!probeEndpoint) {
          throw new Error('Probe endpoint not found');
        }

        const response = await fetch(getEndpointUrl(omniparserService, probeEndpoint));
        const data = await response.json() as ProbeResponse;
        updateServiceStatus('omniparser', 'online');
      } catch (err) {
        console.error('Service status check failed:', err);
        updateServiceStatus('omniparser', 'inactive');
      }
    };

    // Check immediately
    checkServiceStatus();

    // Then check every 30 seconds
    const interval = setInterval(checkServiceStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  // Get the latest parse result
  const getLatestParseResult = () => {
    if (!omniparserService) return null;
    const outputs = getEndpointOutputs('omniparser', '/parse/');
    return outputs.length > 0 ? outputs[outputs.length - 1] : null;
  };

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64 = base64String.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Send request to the parse endpoint
  const handleParseRequest = async () => {
    if (!selectedFile || !omniparserService) return;

    try {
      setIsParsing(true);

      const parseEndpoint = omniparserService.endpoints.find(
        endpoint => endpoint.path === '/parse/' && endpoint.method === 'POST'
      );

      if (!parseEndpoint) {
        throw new Error('Parse endpoint not found');
      }

      const base64Image = await fileToBase64(selectedFile);

      const response = await fetch(getEndpointUrl(omniparserService, parseEndpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64_image: base64Image }),
      });

      const data = await response.json() as ParseResponse;

      // Store the parse result in the service store
      addEndpointOutput('omniparser', '/parse/', data);

      console.log('Parse successful:', data);
    } catch (err) {
      console.error('Parse error:', err);
      addEndpointOutput('omniparser', '/parse/', null, err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsParsing(false);
    }
  };

  // Reset the form
  const handleReset = () => {
    setSelectedFile(null);
    setPreviewImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get the latest parse result for display
  const latestParseResult = getLatestParseResult();
  const parsedImage = latestParseResult?.data?.som_image_base64 ? `data:image/jpeg;base64,${latestParseResult.data.som_image_base64}` : undefined;
  const parsedContent = latestParseResult?.data?.parsed_content_list;
  const parseLatency = latestParseResult?.data?.latency;

  return (
    <div className="flex flex-col px-2 h-full space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold">Omniparser</h1>

        {/* Service Info */}
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span className="font-mono">{omniparserService?.baseUrl}:{omniparserService?.port}</span>
          <span>•</span>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${omniparserService?.status === 'online' ? 'bg-green-500' :
              omniparserService?.status === 'inactive' ? 'bg-muted' : 'bg-destructive'
              }`}></div>
            <span className="capitalize">{omniparserService?.status || 'unknown'}</span>
          </div>
        </div>

        {/* Service Description */}
        <div className="mt-2 text-sm text-muted-foreground">
          <p>
            The Omniparser service is a powerful image parsing tool that can analyze and extract structured data from various types of images.
            It supports multiple image formats and can identify text, tables, and other structured elements within images.
            The service provides both visual feedback through annotated images and structured data output for further processing.
          </p>
        </div>
      </div>

      <Tabs defaultValue="parse" className="w-full flex-1">
        <TabsList className='grid w-full grid-cols-1'>
          <TabsTrigger value="parse">/parse</TabsTrigger>
        </TabsList>

        <TabsContent value="parse" className="flex flex-row space-y-4">
          <div className="flex flex-1 gap-4">
            {/* Input Card */}
            <Card className="w-1/2 flex flex-col flex-1">
              <CardHeader className="flex-none">
                <CardTitle>Request</CardTitle>
                <CardDescription>Upload an image to parse</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <>
                  {/* File Upload and Reset Button */}
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                      />
                    </div>
                    <Button
                      onClick={handleReset}
                      disabled={isParsing || (!selectedFile && !parsedImage)}
                      variant="outline"
                    >
                      Reset
                    </Button>
                  </div>

                  {/* Preview Image */}
                  {previewImage && (
                    <div>
                      <div className="border border-border rounded p-1">
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="max-w-full max-h-48 object-contain"
                        />
                      </div>
                    </div>
                  )}
                </>
              </CardContent>
              <CardFooter className="flex-none">
                <Button
                  onClick={handleParseRequest}
                  disabled={isParsing || !selectedFile}
                  variant="default"
                  className="w-full"
                >
                  {isParsing ? 'Parsing...' : 'Parse Image'}
                </Button>
              </CardFooter>
            </Card>

            {/* Output Card */}
            <Card className="w-1/2 flex flex-col flex-1">
              <CardHeader className="flex-none">
                <CardTitle>Response</CardTitle>
                <CardDescription>Parsed results and visualization</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {latestParseResult ? (
                  <>
                    {/* Parsed Image */}
                    {parsedImage && (
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Parsed Image</h3>
                        <div className="border border-border rounded p-1">
                          <img
                            src={parsedImage}
                            alt="Parsed"
                            className="max-w-full max-h-48 object-contain"
                          />
                        </div>
                      </div>
                    )}

                    {/* Parsed Content */}
                    {parsedContent && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Parsed Content</h3>
                        <pre className="text-sm text-foreground/80 whitespace-pre-wrap overflow-auto max-h-40">
                          {JSON.stringify(parsedContent, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Latency */}
                    {parseLatency && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Latency: {parseLatency}ms
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    No parse results yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 