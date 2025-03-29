'use client'

import React, { useState, useEffect } from 'react';
import { useServiceStore } from '@/store/service/serviceStore';
import { getEndpointUrl } from '@/models/service/serviceModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  ProbeResponse,
  ClickResponse,
  MoveResponse,
  ScreenSizeResponse,
  ScreenshotBase64Response
} from './types';

export default function OperatorPage() {
  // Mouse control states
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const [buttonType, setButtonType] = useState<'left' | 'right' | 'middle'>('left');
  const [actionResult, setActionResult] = useState<string | null>(null);
  
  // Screen size state
  const [screenSize, setScreenSize] = useState<{ width: number; height: number } | null>(null);
  
  // Screenshot states
  const [screenshotImage, setScreenshotImage] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(true);
  const [region, setRegion] = useState<number[]>([0, 0, 800, 600]);
  const [screenshotFormat, setScreenshotFormat] = useState<string>('png');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Get the operator service and update function from the store
  const operatorService = useServiceStore(state => state.getService('operator'));
  const updateServiceStatus = useServiceStore(state => state.updateServiceStatus);
  const addEndpointOutput = useServiceStore(state => state.addEndpointOutput);

  // Check service status periodically
  useEffect(() => {
    const checkServiceStatus = async () => {
      if (!operatorService) return;

      try {
        const probeEndpoint = operatorService.endpoints.find(
          endpoint => endpoint.path === '/probe' && endpoint.method === 'GET'
        );

        if (!probeEndpoint) {
          throw new Error('Probe endpoint not found');
        }

        console.log("Probe endpoint:", getEndpointUrl(operatorService, probeEndpoint));

        const response = await fetch(getEndpointUrl(operatorService, probeEndpoint));
        const data = await response.json() as ProbeResponse;
        console.log("Probe response:", data);
        updateServiceStatus('operator', 'online');
        
        // Get screen size after successful probe
        handleGetScreenSize();
      } catch (err) {
        console.error('Service status check failed:', err);
        updateServiceStatus('operator', 'inactive');
      }
    };

    // Check immediately
    checkServiceStatus();

    // Then check every 30 seconds
    const interval = setInterval(checkServiceStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  // Get screen size
  const handleGetScreenSize = async () => {
    if (!operatorService) return;

    try {
      const screenSizeEndpoint = operatorService.endpoints.find(
        endpoint => endpoint.path === '/screen_size' && endpoint.method === 'GET'
      );

      if (!screenSizeEndpoint) {
        throw new Error('Screen size endpoint not found');
      }

      const response = await fetch(getEndpointUrl(operatorService, screenSizeEndpoint));
      const data = await response.json() as ScreenSizeResponse;
      addEndpointOutput('operator', '/screen_size', data);
      setScreenSize(data);
      setRegion([0, 0, data.width / 2, data.height / 2]);
    } catch (err) {
      console.error('Screen size error:', err);
    }
  };

  // Handle mouse click
  const handleMouseClick = async () => {
    if (!operatorService) return;

    try {
      const clickEndpoint = operatorService.endpoints.find(
        endpoint => endpoint.path === '/click' && endpoint.method === 'POST'
      );

      if (!clickEndpoint) {
        throw new Error('Click endpoint not found');
      }

      const response = await fetch(getEndpointUrl(operatorService, clickEndpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          x: mouseX, 
          y: mouseY,
          button: buttonType
        }),
      });

      const data = await response.json() as ClickResponse;
      setActionResult(data.message);
    } catch (err) {
      console.error('Click error:', err);
    }
  };

  // Handle mouse move
  const handleMouseMove = async () => {
    if (!operatorService) return;

    try {
      const moveEndpoint = operatorService.endpoints.find(
        endpoint => endpoint.path === '/move' && endpoint.method === 'POST'
      );

      if (!moveEndpoint) {
        throw new Error('Move endpoint not found');
      }

      const response = await fetch(getEndpointUrl(operatorService, moveEndpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          x: mouseX, 
          y: mouseY 
        }),
      });

      const data = await response.json() as MoveResponse;
      setActionResult(data.message);
    } catch (err) {
      console.error('Move error:', err);
    }
  };

  // Handle screenshot capture
  const handleScreenshot = async () => {
    if (!operatorService) return;

    try {
      setIsCapturing(true);
      const screenshotEndpoint = operatorService.endpoints.find(
        endpoint => endpoint.path === '/screenshot_base64' && endpoint.method === 'POST'
      );

      if (!screenshotEndpoint) {
        throw new Error('Screenshot endpoint not found');
      }

      const requestBody: any = {
        format: screenshotFormat,
        full_screen: isFullScreen
      };

      if (!isFullScreen) {
        requestBody.region = region;
      }

      const response = await fetch(getEndpointUrl(operatorService, screenshotEndpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json() as ScreenshotBase64Response;
      setScreenshotImage(`data:image/${data.format};base64,${data.base64_image}`);
    } catch (err) {
      console.error('Screenshot error:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle region input change
  const handleRegionChange = (index: number, value: string) => {
    const newValue = parseInt(value);
    if (!isNaN(newValue)) {
      const newRegion = [...region];
      newRegion[index] = newValue;
      setRegion(newRegion);
    }
  };

  return (
    <div className="flex flex-col px-2 h-full overflow-y-auto space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold">Operator</h1>

        {/* Service Info */}
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span className="font-mono">{operatorService?.baseUrl}:{operatorService?.port}</span>
          <span>•</span>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${operatorService?.status === 'online' ? 'bg-green-500' :
              operatorService?.status === 'inactive' ? 'bg-muted' : 'bg-destructive'
              }`}></div>
            <span className="capitalize">{operatorService?.status || 'unknown'}</span>
          </div>
        </div>

        {/* Service Description */}
        <div className="mt-2 text-sm text-muted-foreground">
          <p>
            The Operator service provides mouse and keyboard control capabilities for automation tasks.
            It supports mouse movement, clicks, and keyboard input, as well as screen capture functionality.
            The service can be used to automate various desktop interactions and capture screen content.
          </p>
        </div>
      </div>

      <Tabs defaultValue="mouse" className="w-full flex-1">
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value="mouse">Mouse Control</TabsTrigger>
          <TabsTrigger value="screenshot">Screenshot</TabsTrigger>
        </TabsList>

        <TabsContent value="mouse" className="flex flex-row space-y-4">
          <div className="flex flex-1 gap-4">
            {/* Mouse Control Card */}
            <Card className="w-1/2 flex flex-col flex-1">
              <CardHeader className="flex-none">
                <CardTitle>Mouse Control</CardTitle>
                <CardDescription>Control mouse movement and clicks</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <div className="space-y-4">
                  {/* Mouse Position */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Mouse Position</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">X</label>
                        <Input
                          type="number"
                          value={mouseX}
                          onChange={(e) => setMouseX(parseInt(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Y</label>
                        <Input
                          type="number"
                          value={mouseY}
                          onChange={(e) => setMouseY(parseInt(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mouse Button */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Mouse Button</h3>
                    <Select value={buttonType} onValueChange={(value: 'left' | 'right' | 'middle') => setButtonType(value)}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                        <SelectItem value="middle">Middle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleMouseMove}
                      variant="outline"
                      className="flex-1"
                    >
                      Move
                    </Button>
                    <Button
                      onClick={handleMouseClick}
                      variant="default"
                      className="flex-1"
                    >
                      Click
                    </Button>
                  </div>

                  {/* Action Result */}
                  {actionResult && (
                    <div className="text-sm text-muted-foreground">
                      {actionResult}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Screen Size Card */}
            <Card className="w-1/2 flex flex-col flex-1">
              <CardHeader className="flex-none">
                <CardTitle>Screen Size</CardTitle>
                <CardDescription>Current screen dimensions</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {screenSize ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Width</label>
                      <div className="text-sm">{screenSize.width}</div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Height</label>
                      <div className="text-sm">{screenSize.height}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    Screen size not available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="screenshot" className="flex flex-row space-y-4">
          <div className="flex flex-1 gap-4">
            {/* Screenshot Control Card */}
            <Card className="w-1/2 flex flex-col flex-1">
              <CardHeader className="flex-none">
                <CardTitle>Screenshot Control</CardTitle>
                <CardDescription>Capture screen content</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <div className="space-y-4">
                  {/* Screenshot Format */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Format</h3>
                    <Select value={screenshotFormat} onValueChange={setScreenshotFormat}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="jpeg">JPEG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Full Screen Option */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fullScreen"
                      checked={isFullScreen}
                      onCheckedChange={(checked) => setIsFullScreen(checked as boolean)}
                    />
                    <label
                      htmlFor="fullScreen"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Full Screen
                    </label>
                  </div>

                  {/* Region Inputs */}
                  {!isFullScreen && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Region</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">X</label>
                          <Input
                            type="number"
                            value={region[0]}
                            onChange={(e) => handleRegionChange(0, e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Y</label>
                          <Input
                            type="number"
                            value={region[1]}
                            onChange={(e) => handleRegionChange(1, e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Width</label>
                          <Input
                            type="number"
                            value={region[2]}
                            onChange={(e) => handleRegionChange(2, e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Height</label>
                          <Input
                            type="number"
                            value={region[3]}
                            onChange={(e) => handleRegionChange(3, e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Capture Button */}
                  <Button
                    onClick={handleScreenshot}
                    disabled={isCapturing}
                    variant="default"
                    className="w-full"
                  >
                    {isCapturing ? 'Capturing...' : 'Capture Screenshot'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Screenshot Preview Card */}
            <Card className="w-1/2 flex flex-col flex-1">
              <CardHeader className="flex-none">
                <CardTitle>Preview</CardTitle>
                <CardDescription>Screenshot result</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {screenshotImage ? (
                  <div className="border border-border rounded p-1">
                    <img
                      src={screenshotImage}
                      alt="Screenshot"
                      className="max-w-full max-h-[calc(100vh-300px)] object-contain"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    No screenshot yet
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