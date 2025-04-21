'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Check, Loader2 } from 'lucide-react'; // Removed unused icons
import Coordinates from '@/components/mini-browser';
import { Badge } from '@/components/ui/badge';

interface PlaywrightTestProps {
  className?: string;
}

type BrowserStatus = 'not-initialized' | 'initializing' | 'ready' | 'error';
// type ResponseStatus = 'success' | 'error' | 'loading' | null; // Unused
type InitProcessStatus = 'idle' | 'initializing' | 'navigating' | 'screenshotting' | 'ready' | 'failed';

// Viewport presets
const VIEWPORT_PRESETS = {
  'desktop': { width: 1920, height: 1080, label: 'Desktop (1920×1080)' },
  'laptop': { width: 1366, height: 768, label: 'Laptop (1366×768)' },
  'tablet': { width: 768, height: 1024, label: 'Tablet (768×1024)' },
  'mobile': { width: 375, height: 667, label: 'Mobile (375×667)' },
  'default': { width: 1024, height: 768, label: 'Default (1024×768)' },
};

type ViewportPresetKey = keyof typeof VIEWPORT_PRESETS;

const PlaywrightTestPage: React.FC<PlaywrightTestProps> = ({ className }) => {
  // Browser state
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus>('not-initialized');
  const [initProcessStatus, setInitProcessStatus] = useState<InitProcessStatus>('idle');
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [viewportHeight, setViewportHeight] = useState(768);
  const [selectedPreset, setSelectedPreset] = useState<ViewportPresetKey>('default');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);

  // API call helper
  const callPlaywrightAPI = async (action: string, params: any = {}) => {
    // setResponseStatus('loading'); // Removed response status update
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...params
        }),
      });

      const data = await response.json();

      // Handle screenshot data
      if (action === 'screenshot' && data.success && data.data) {
        setScreenshotData(`data:image/png;base64,${data.data}`);
      }

      // setResponse(data); // Removed response update
      // setResponseStatus(data.success ? 'success' : 'error'); // Removed response status update

      // Update browser status if initializing or cleanup
      if (action === 'init' && data.success) {
        setBrowserStatus('ready');
        // Update viewport dimensions if returned from API (e.g., if init adjusted it)
        if (data.viewport) {
          setViewportWidth(data.viewport.width);
          setViewportHeight(data.viewport.height);
        }
      } else if (action === 'cleanup') {
        setBrowserStatus('not-initialized');
        setInitProcessStatus('idle');
        setScreenshotData(null);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      // setResponse({ error: String(error) }); // Removed response update
      // setResponseStatus('error'); // Removed response status update
      return { success: false, error: String(error) };
    }
  };

  // Initialize browser
  const handleInitialize = async () => {
    setBrowserStatus('initializing');
    setInitProcessStatus('initializing');
    setScreenshotData(null);
    // setShowApiResponse(false); // Unused

    const initResponse = await callPlaywrightAPI('init', {
      width: viewportWidth,
      height: viewportHeight
    });

    // If initialization was successful, navigate and take screenshot
    if (initResponse.success) {
      // setUrl('https://google.com'); // Removed unused state update
      setInitProcessStatus('navigating');
      const gotoResponse = await callPlaywrightAPI('goto', { url: 'https://google.com' }); // Default navigation on init

      if (gotoResponse.success) {
        setInitProcessStatus('screenshotting');
        // Wait 2 seconds before taking screenshot
        setTimeout(async () => {
          const screenshotResponse = await callPlaywrightAPI('screenshot');
          if (screenshotResponse.success && screenshotResponse.data) {
            setInitProcessStatus('ready');
          } else {
            console.error("Screenshot failed:", screenshotResponse.error);
            setInitProcessStatus('failed');
            setBrowserStatus('error');
          }
        }, 2000);
      } else {
        console.error("Navigation failed:", gotoResponse.error);
        setInitProcessStatus('failed');
        setBrowserStatus('error');
      }
    } else {
      console.error("Initialization failed:", initResponse.error);
      setInitProcessStatus('failed');
      setBrowserStatus('error');
    }
  };

  // Cleanup browser
  const handleCleanup = async () => {
    await callPlaywrightAPI('cleanup');
  };

  // Refresh screenshot with a 1-second delay
  const refreshScreenshot = async () => {
    setTimeout(async () => {
      await callPlaywrightAPI('screenshot');
    }, 1000);
  };

  // Handle viewport preset change
  const handleViewportPresetChange = (value: ViewportPresetKey) => {
    setSelectedPreset(value);
    const preset = VIEWPORT_PRESETS[value];
    setViewportWidth(preset.width);
    setViewportHeight(preset.height);
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Browser Initialization Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold">Browser Initialization</h3>
            <Badge variant={browserStatus === 'ready' ? 'outline' : browserStatus === 'initializing' ? 'secondary' : browserStatus === 'error' ? 'destructive' : 'outline'}>
              {browserStatus === 'ready' ? 'Ready' : browserStatus === 'initializing' ? 'Initializing...' : browserStatus === 'error' ? 'Error' : 'Not Initialized'}
              {browserStatus === 'ready' && ` (${viewportWidth} × ${viewportHeight})`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2 md:col-span-1">
                <Label>Viewport Preset</Label>
                <Select
                  value={selectedPreset}
                  onValueChange={(value) => handleViewportPresetChange(value as ViewportPresetKey)}
                  disabled={browserStatus === 'initializing' || browserStatus === 'ready'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a viewport size" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VIEWPORT_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 md:col-span-2 justify-start md:justify-end">
                <Button
                  onClick={handleInitialize}
                  disabled={browserStatus === 'initializing' || browserStatus === 'ready'}
                  variant="default"
                >
                  {browserStatus === 'initializing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Initialize
                </Button>
                <Button
                  onClick={handleCleanup}
                  disabled={browserStatus === 'not-initialized' || browserStatus === 'initializing'}
                  variant="outline"
                >
                  Cleanup
                </Button>
              </div>
            </div>
            {/* Detailed Initialization Status Display */}
            {initProcessStatus !== 'idle' && (
              <div className="mt-4 p-3 rounded-md border text-sm flex items-center gap-2" style={{
                borderColor: initProcessStatus === 'failed' ? 'hsl(var(--destructive))' : initProcessStatus === 'ready' ? 'hsl(var(--success))' : 'hsl(var(--border))',
                backgroundColor: initProcessStatus === 'failed' ? 'hsl(var(--destructive) / 0.1)' : initProcessStatus === 'ready' ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--muted) / 0.3)',
                color: initProcessStatus === 'failed' ? 'hsl(var(--destructive))' : initProcessStatus === 'ready' ? 'hsl(var(--success))' : 'hsl(var(--foreground))',
              }}>
                {initProcessStatus === 'initializing' && <><Loader2 className="h-4 w-4 animate-spin" /> Initializing browser...</>}
                {initProcessStatus === 'navigating' && <><Loader2 className="h-4 w-4 animate-spin" /> Navigating to Google.com...</>}
                {initProcessStatus === 'screenshotting' && <><Loader2 className="h-4 w-4 animate-spin" /> Taking screenshot (waiting 2s)...</>}
                {initProcessStatus === 'ready' && <><Check className="h-4 w-4 text-green-600" /> Initialization & Screenshot successful.</>}
                {initProcessStatus === 'failed' && <><AlertCircle className="h-4 w-4 text-red-600" /> Process failed. Check API response for details.</>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Screenshot Display Card (Coordinates) */}
      {screenshotData && (
        <Coordinates
          screenshotData={screenshotData}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
          onRefresh={refreshScreenshot}
        />
      )}
    </div>
  );
};

export default PlaywrightTestPage;
