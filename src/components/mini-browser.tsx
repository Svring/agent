import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, ArrowRightCircle, Eye, EyeOff, ChevronLeft, ChevronRight, Frame, Cookie, Loader2, AlertCircle, Check, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type BrowserStatus = 'not-initialized' | 'initializing' | 'ready' | 'error';
type InitProcessStatus = 'idle' | 'initializing' | 'navigating' | 'screenshotting' | 'ready' | 'failed';

const VIEWPORT_PRESETS = {
  'desktop': { width: 1920, height: 1080, label: 'Desktop (1920×1080)' },
  'laptop': { width: 1366, height: 768, label: 'Laptop (1366×768)' },
  'tablet': { width: 768, height: 1024, label: 'Tablet (768×1024)' },
  'mobile': { width: 375, height: 667, label: 'Mobile (375×667)' },
  'default': { width: 1024, height: 768, label: 'Default (1024×768)' },
};
type ViewportPresetKey = keyof typeof VIEWPORT_PRESETS;

const MiniBrowser: React.FC = () => {
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus>('not-initialized');
  const [initProcessStatus, setInitProcessStatus] = useState<InitProcessStatus>('idle');
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [viewportHeight, setViewportHeight] = useState(768);
  const [selectedPreset, setSelectedPreset] = useState<ViewportPresetKey>('default');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);

  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const interactionDivRef = useRef<HTMLDivElement>(null);
  const [showAxes, setShowAxes] = useState(true);

  const callPlaywrightAPI = async (action: string, params: any = {}) => {
    setIsRefreshing(true);
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

      if ((action === 'screenshot' || action === 'init' || action === 'goto' || action === 'click' || action === 'doubleClick' || action === 'scroll' || action === 'pressKey' || action === 'goBack' || action === 'goForward') && data.success) {
        const screenshotResponse = await fetch('/api/playwright', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'screenshot' })
        });
        const screenshotDataPayload = await screenshotResponse.json();
        if (screenshotDataPayload.success && screenshotDataPayload.data) {
          setScreenshotData(`data:image/png;base64,${screenshotDataPayload.data}`);
          if (screenshotDataPayload.viewport) {
            setViewportWidth(screenshotDataPayload.viewport.width);
            setViewportHeight(screenshotDataPayload.viewport.height);
          }
        }
      } else if (action === 'cleanup') {
        setScreenshotData(null);
        setBrowserStatus('not-initialized');
        setInitProcessStatus('idle');
      }

      if (action === 'init') {
        if (data.success) {
          setBrowserStatus('ready');
          if (data.viewport) {
            setViewportWidth(data.viewport.width);
            setViewportHeight(data.viewport.height);
          }
        } else {
          setBrowserStatus('error');
          setInitProcessStatus('failed');
        }
      }

      return data;
    } catch (error) {
      console.error(`API Error during ${action}:`, error);
      if (action === 'init') {
        setBrowserStatus('error');
        setInitProcessStatus('failed');
      }
      return { success: false, error: String(error) };
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  const handleInitialize = async () => {
    setBrowserStatus('initializing');
    setInitProcessStatus('initializing');
    setScreenshotData(null);

    const initResponse = await callPlaywrightAPI('init', {
      width: viewportWidth,
      height: viewportHeight
    });

    if (initResponse.success) {
      setInitProcessStatus('navigating');
      const gotoResponse = await callPlaywrightAPI('goto', { url: 'https://google.com' });

      if (gotoResponse.success) {
        setInitProcessStatus('screenshotting');
        setTimeout(() => {
          if (browserStatus !== 'error') {
            setInitProcessStatus('ready');
          }
        }, 2000);
      } else {
        console.error("Navigation failed:", gotoResponse.error);
        setInitProcessStatus('failed');
        setBrowserStatus('error');
      }
    } else {
      console.error("Initialization failed:", initResponse.error);
    }
  };

  const handleCleanup = async () => {
    await callPlaywrightAPI('cleanup');
  };

  const refreshScreenshot = async () => {
    if (browserStatus === 'ready' || browserStatus === 'initializing') {
      console.log("Refreshing screenshot...");
      await callPlaywrightAPI('screenshot');
    }
  };

  const handleViewportPresetChange = (value: ViewportPresetKey) => {
    setSelectedPreset(value);
    const preset = VIEWPORT_PRESETS[value];
    setViewportWidth(preset.width);
    setViewportHeight(preset.height);
  };

  useEffect(() => {
    if (screenshotData) {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = screenshotData;
    } else {
      setImageDimensions(null);
    }
  }, [screenshotData]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (imageDimensions) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (viewportWidth / rect.width));
      const y = Math.round((e.clientY - rect.top) * (viewportHeight / rect.height));
      setCursorPosition({ x, y });
    }
  };

  const handleMouseLeave = () => {
    setCursorPosition(null);
  };

  const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (document.activeElement !== interactionDivRef.current || browserStatus !== 'ready') return;
    if (e.detail === 1) {
      if (cursorPosition) {
        await callPlaywrightAPI('click', { x: cursorPosition.x, y: cursorPosition.y });
        interactionDivRef.current?.focus();
      }
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (document.activeElement !== interactionDivRef.current || browserStatus !== 'ready') return;
    if (cursorPosition) {
      await callPlaywrightAPI('doubleClick', { x: cursorPosition.x, y: cursorPosition.y });
      interactionDivRef.current?.focus();
    }
  };

  const handleWheel = async (e: React.WheelEvent<HTMLDivElement>) => {
    if (document.activeElement !== interactionDivRef.current || browserStatus !== 'ready') return;
    e.preventDefault();
    await callPlaywrightAPI('scroll', { deltaX: e.deltaX, deltaY: e.deltaY });
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (document.activeElement !== interactionDivRef.current || browserStatus !== 'ready') return;
    e.preventDefault();
    const key = e.key;
    console.log('Key pressed:', key);
    await callPlaywrightAPI('pressKey', { key: key });
  };

  const targetInterval = 100;
  const numWidthLines = Math.max(2, Math.round(viewportWidth / targetInterval));
  const numHeightLines = Math.max(2, Math.round(viewportHeight / targetInterval));
  const widthInterval = viewportWidth / (numWidthLines > 1 ? numWidthLines - 1 : 1);
  const heightInterval = viewportHeight / (numHeightLines > 1 ? numHeightLines - 1 : 1);

  const widthPoints = Array.from({ length: numWidthLines }, (_, i) => i * widthInterval);
  const heightPoints = Array.from({ length: numHeightLines }, (_, i) => i * heightInterval);

  const renderTitleBarButtons = () => (
    <div className="flex items-center gap-2">
      <Button
        onClick={async () => await callPlaywrightAPI('goBack')}
        variant="outline" size="sm" title="Go Back"
        disabled={browserStatus !== 'ready'}
      > <ChevronLeft className="h-4 w-4" /> </Button>
      <Button
        onClick={async () => await callPlaywrightAPI('goForward')}
        variant="outline" size="sm" title="Go Forward"
        disabled={browserStatus !== 'ready'}
      > <ChevronRight className="h-4 w-4" /> </Button>
      <Button
        onClick={async () => {
          const response = await fetch('/api/playwright', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'getCookies',
              url: urlInput || 'https://hzh.sealos.run/?s=bd-sealos-marketing-appstore'
            })
          });
          const data = await response.json();
          if (data.success) {
            console.log('Cookies fetched:', data.cookies);
          } else {
            console.error('Failed to get cookies:', data.message);
          }
        }}
        variant="outline" size="sm" title="Get Cookies for Current/Input URL"
        disabled={browserStatus !== 'ready'}
      > <Cookie className="h-4 w-4" /> </Button>
      <Button
        onClick={handleCleanup}
        disabled={browserStatus === 'not-initialized' || browserStatus === 'initializing'}
        variant="outline" size="sm" title="Cleanup Browser Instance"
      > <Trash2 className="h-4 w-4" /> </Button>

      <div className="flex-grow max-w-md mx-auto">
        <Input
          placeholder="Enter URL (e.g., google.com)"
          className="w-full h-8"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          disabled={browserStatus !== 'ready'}
          onKeyDown={(e) => { if (e.key === 'Enter') callPlaywrightAPI('goto', { url: urlInput || 'https://google.com' }); }}
        />
      </div>

      <Button
        onClick={async () => await callPlaywrightAPI('goto', { url: urlInput || 'https://google.com' })}
        variant="outline" size="sm" title="Go to URL"
        disabled={browserStatus !== 'ready' || !urlInput}
      > <ArrowRightCircle className="h-4 w-4" /> </Button>
      <Button
        onClick={refreshScreenshot}
        variant="outline" size="sm" title="Refresh Screenshot"
        disabled={browserStatus !== 'ready' || isRefreshing}
      > <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> </Button>
      <Button
        onClick={() => setShowAxes(!showAxes)}
        variant="outline" size="sm" title={showAxes ? 'Hide Axes' : 'Show Axes'}
      > {showAxes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} </Button>
    </div>
  );

  return (
    <Card className="w-fit mx-auto bg-background">
      {browserStatus !== 'not-initialized' && (
        <CardHeader>
          {renderTitleBarButtons()}
          {initProcessStatus !== 'idle' && initProcessStatus !== 'ready' && (
            <div className="mt-2 p-2 rounded-md border text-xs flex items-center gap-2" style={{ borderColor: initProcessStatus === 'failed' ? 'hsl(var(--destructive))' : 'hsl(var(--border))', backgroundColor: initProcessStatus === 'failed' ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--muted) / 0.3)', color: initProcessStatus === 'failed' ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))' }}>
              {initProcessStatus === 'initializing' && <><Loader2 className="h-3 w-3 animate-spin" /> Initializing...</>}
              {initProcessStatus === 'navigating' && <><Loader2 className="h-3 w-3 animate-spin" /> Navigating...</>}
              {initProcessStatus === 'screenshotting' && <><Loader2 className="h-3 w-3 animate-spin" /> Screenshotting...</>}
              {initProcessStatus === 'failed' && <><AlertCircle className="h-3 w-3" /> Failed.</>}
            </div>
          )}
        </CardHeader>
      )}
      <CardContent className="p-0">
        {browserStatus === 'not-initialized' ? (
          <div className="flex flex-col items-center justify-center border rounded-lg" style={{ width: '1024px', height: '768px', maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', aspectRatio: '1024 / 768' }}>
            <div className="p-6 bg-background rounded-xl shadow-lg max-w-xs w-full text-center">
              <div className="space-y-4 mb-6">
                <Label htmlFor="viewport-preset" className="text-sm font-medium text-foreground/70">Viewport Preset</Label>
                <Select
                  value={selectedPreset}
                  onValueChange={(value) => handleViewportPresetChange(value as ViewportPresetKey)}
                  disabled={browserStatus !== 'not-initialized'}
                >
                  <SelectTrigger id="viewport-preset" className="w-full rounded-md border-border/60 focus:ring-2 focus:ring-ring/50">
                    <SelectValue placeholder="Select a viewport size" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border/60">
                    {Object.entries(VIEWPORT_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key} className="data-[highlighted]:bg-muted/30">{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleInitialize}
                disabled={browserStatus !== 'not-initialized'}
                className="w-full rounded-md bg-primary hover:bg-primary/90 transition-colors"
              >
                Initialize ({VIEWPORT_PRESETS[selectedPreset].width}×{VIEWPORT_PRESETS[selectedPreset].height})
              </Button>
            </div>
          </div>
        ) : screenshotData && imageDimensions ? (
          <div
            ref={interactionDivRef}
            tabIndex={0}
            className="relative rounded-md inline-block focus:outline-1 focus:outline-offset-1 focus:outline-white"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            style={{
              cursor: 'crosshair',
              height: 'auto',
              aspectRatio: `${viewportWidth} / ${viewportHeight}`,
              maxWidth: `${viewportWidth}px`,
              maxHeight: `calc(100vh - 150px)`,
              overflow: 'hidden'
            }}
          >
            <img
              src={screenshotData}
              alt="Browser Screenshot"
              className="w-full h-full object-contain p-1 rounded-md"
            />
            {showAxes && (
              <>
                <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded z-10">
                  {viewportWidth} × {viewportHeight}
                </div>
                {cursorPosition && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded z-10">
                    X: {cursorPosition.x}px, Y: {cursorPosition.y}px
                  </div>
                )}
                {isRefreshing && (
                  <div className="absolute bottom-2 left-2 bg-blue-600 bg-opacity-70 text-white text-xs px-2 py-1 rounded z-10 animate-pulse">
                    <Loader2 className="inline-block mr-1 h-3 w-3 animate-spin" /> Loading...
                  </div>
                )}
                <svg
                  className="absolute inset-0 z-0"
                  style={{ width: '100%', height: '100%' }}
                  pointerEvents="none"
                  viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
                  preserveAspectRatio="none"
                >
                  {widthPoints.map((x, index) => (
                    <line
                      key={`x-${index}`} x1={x} y1={0} x2={x} y2={viewportHeight}
                      stroke="rgba(255, 0, 0, 0.3)" strokeWidth="1" strokeDasharray="4,4"
                    />
                  ))}
                  {heightPoints.map((y, index) => (
                    <line
                      key={`y-${index}`} x1={0} y1={y} x2={viewportWidth} y2={y}
                      stroke="rgba(0, 0, 255, 0.3)" strokeWidth="1" strokeDasharray="4,4"
                    />
                  ))}
                  {widthPoints.map((x, index) => (
                    <text
                      key={`x-label-${index}`} x={x} y={viewportHeight - 5}
                      fill="rgba(255, 0, 0, 0.7)" fontSize="10" textAnchor="middle"
                    > {Math.round(x).toFixed(0)} </text>
                  ))}
                  {heightPoints.map((y, index) => (
                    <text
                      key={`y-label-${index}`} x={5} y={y + 3}
                      fill="rgba(0, 0, 255, 0.7)" fontSize="10" textAnchor="start"
                    > {Math.round(y).toFixed(0)} </text>
                  ))}
                </svg>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center border rounded-b-md text-muted-foreground" style={{ width: '1024px', height: '768px', maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', aspectRatio: '1024 / 768', backgroundColor: 'hsl(var(--muted))' }}>
            {browserStatus === 'initializing' && <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Initializing Browser...</>}
            {browserStatus === 'error' && <><AlertCircle className="mr-2 h-5 w-5 text-destructive" /> Initialization Failed. Check console or try again.</>}
            {browserStatus === 'ready' && !screenshotData && <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Waiting for screenshot...</>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MiniBrowser;
