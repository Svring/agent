import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, ArrowRightCircle, Eye, EyeOff, ChevronLeft, ChevronRight, Frame, Cookie, Loader2, AlertCircle, Check, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type BrowserStatus = 'not-initialized' | 'initializing' | 'ready' | 'error';

const VIEWPORT_PRESETS = {
  'desktop': { width: 1920, height: 1080, label: 'Desktop (1920×1080)' },
  'laptop': { width: 1366, height: 768, label: 'Laptop (1366×768)' },
  'tablet': { width: 768, height: 1024, label: 'Tablet (768×1024)' },
  'mobile': { width: 375, height: 667, label: 'Mobile (375×667)' },
  'default': { width: 1024, height: 768, label: 'Default (1024×768)' },
};
type ViewportPresetKey = keyof typeof VIEWPORT_PRESETS;

const callPlaywrightAPI = async (
  action: string,
  params: any = {},
  setIsRefreshing?: React.Dispatch<React.SetStateAction<boolean>>,
  setScreenshotData?: React.Dispatch<React.SetStateAction<string | null>>,
  setViewportWidth?: React.Dispatch<React.SetStateAction<number>>,
  setViewportHeight?: React.Dispatch<React.SetStateAction<number>>,
  setBrowserStatus?: React.Dispatch<React.SetStateAction<BrowserStatus>>
) => {
  if (setIsRefreshing) setIsRefreshing(true);
  try {
    const response = await fetch('/api/playwright', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });
    const data = await response.json();

    if (
      ['screenshot', 'init', 'goto', 'click', 'doubleClick', 'scroll', 'pressKey', 'goBack', 'goForward'].includes(action) &&
      data.success &&
      setScreenshotData
    ) {
      const screenshotDataPayload = await (
        await fetch('/api/playwright', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'screenshot' }),
        })
      ).json();
      if (screenshotDataPayload.success && screenshotDataPayload.data) {
        setScreenshotData(`data:image/png;base64,${screenshotDataPayload.data}`);
        if (screenshotDataPayload.viewport && setViewportWidth && setViewportHeight) {
          setViewportWidth(screenshotDataPayload.viewport.width);
          setViewportHeight(screenshotDataPayload.viewport.height);
        }
      }
    } else if (action === 'cleanup' && setScreenshotData && setBrowserStatus) {
      setScreenshotData(null);
      setBrowserStatus('not-initialized');
    }

    if (action === 'init' && setBrowserStatus) {
      setBrowserStatus(data.success ? 'ready' : 'error');
      if (data.success && data.viewport && setViewportWidth && setViewportHeight) {
        setViewportWidth(data.viewport.width);
        setViewportHeight(data.viewport.height);
      }
    }

    return data;
  } catch (error) {
    console.error(`API Error during ${action}:`, error);
    if (action === 'init' && setBrowserStatus) setBrowserStatus('error');
    return { success: false, error: String(error) };
  } finally {
    if (setIsRefreshing) setTimeout(() => setIsRefreshing(false), 300);
  }
};

const MiniBrowser: React.FC = () => {
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus>('not-initialized');
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

  useEffect(() => {
    if (screenshotData) {
      const img = new Image();
      img.onload = () => setImageDimensions({ width: img.width, height: img.height });
      img.src = screenshotData;
    } else {
      setImageDimensions(null);
    }
  }, [screenshotData]);

  const handleInitialize = async () => {
    setBrowserStatus('initializing');
    setScreenshotData(null);
    const initResponse = await callPlaywrightAPI('init', { width: viewportWidth, height: viewportHeight }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
    if (initResponse.success) {
      await callPlaywrightAPI('goto', { url: 'https://google.com' }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
    }
  };

  const handleCleanup = async () => {
    await callPlaywrightAPI('cleanup', {}, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
  };

  const refreshScreenshot = async () => {
    if (browserStatus === 'ready') {
      await callPlaywrightAPI('screenshot', {}, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
    }
  };

  const handleViewportPresetChange = (value: ViewportPresetKey) => {
    setSelectedPreset(value);
    const preset = VIEWPORT_PRESETS[value];
    setViewportWidth(preset.width);
    setViewportHeight(preset.height);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (imageDimensions) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (viewportWidth / rect.width));
      const y = Math.round((e.clientY - rect.top) * (viewportHeight / rect.height));
      setCursorPosition({ x, y });
    }
  };

  const handleMouseLeave = () => setCursorPosition(null);

  const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (document.activeElement !== interactionDivRef.current || browserStatus !== 'ready') return;
    if (e.detail === 1 && cursorPosition) {
      await callPlaywrightAPI('click', { x: cursorPosition.x, y: cursorPosition.y }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
      interactionDivRef.current?.focus();
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (document.activeElement !== interactionDivRef.current || browserStatus !== 'ready') return;
    if (cursorPosition) {
      await callPlaywrightAPI('doubleClick', { x: cursorPosition.x, y: cursorPosition.y }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
      interactionDivRef.current?.focus();
    }
  };

  const handleWheel = async (e: React.WheelEvent<HTMLDivElement>) => {
    if (document.activeElement !== interactionDivRef.current || browserStatus !== 'ready') return;
    e.preventDefault();
    await callPlaywrightAPI('scroll', { deltaX: e.deltaX, deltaY: e.deltaY }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (document.activeElement !== interactionDivRef.current || browserStatus !== 'ready') return;
    e.preventDefault();
    await callPlaywrightAPI('pressKey', { key: e.key }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
  };

  const targetInterval = 100;
  const numWidthLines = Math.max(2, Math.round(viewportWidth / targetInterval));
  const numHeightLines = Math.max(2, Math.round(viewportHeight / targetInterval));
  const widthInterval = viewportWidth / (numWidthLines > 1 ? numWidthLines - 1 : 1);
  const heightInterval = viewportHeight / (numHeightLines > 1 ? numHeightLines - 1 : 1);
  const widthPoints = Array.from({ length: numWidthLines }, (_, i) => i * widthInterval);
  const heightPoints = Array.from({ length: numHeightLines }, (_, i) => i * heightInterval);

  const handleGetCookies = async () => {
    const response = await fetch('/api/playwright', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getCookies', url: urlInput || 'https://google.com' }),
    });
    const data = await response.json();
    if (data.success) console.log('Cookies fetched:', data.cookies);
    else console.error('Failed to get cookies:', data.message);
  };

  const handleSaveScreenshot = async () => {
    const response = await fetch('/api/playwright', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'screenshot', options: { path: 'screenshot.png', fullPage: true } }),
    });
    const data = await response.json();
    if (data.success) alert('Screenshot saved successfully to screenshot.png');
    else alert('Failed to save screenshot: ' + data.message);
  };

  const renderTitleBarButtons = () => (
    <div className="flex items-center gap-2">
      <Button onClick={() => callPlaywrightAPI('goBack', {}, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus)} variant="outline" size="sm" title="Go Back" disabled={browserStatus !== 'ready'}> <ChevronLeft className="h-4 w-4" /> </Button>
      <Button onClick={() => callPlaywrightAPI('goForward', {}, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus)} variant="outline" size="sm" title="Go Forward" disabled={browserStatus !== 'ready'}> <ChevronRight className="h-4 w-4" /> </Button>
      <Button onClick={handleGetCookies} variant="outline" size="sm" title="Get Cookies for Current/Input URL" disabled={browserStatus !== 'ready'}> <Cookie className="h-4 w-4" /> </Button>
      <Button onClick={handleCleanup} disabled={browserStatus === 'not-initialized' || browserStatus === 'initializing'} variant="outline" size="sm" title="Cleanup Browser Instance"> <Trash2 className="h-4 w-4" /> </Button>
      <div className="flex-grow max-w-md mx-auto">
        <Input placeholder="Enter URL (e.g., google.com)" className="w-full h-8" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} disabled={browserStatus !== 'ready'} onKeyDown={(e) => { if (e.key === 'Enter') callPlaywrightAPI('goto', { url: urlInput || 'https://google.com' }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus); }} />
      </div>
      <Button onClick={() => callPlaywrightAPI('goto', { url: urlInput || 'https://google.com' }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus)} variant="outline" size="sm" title="Go to URL" disabled={browserStatus !== 'ready' || !urlInput}> <ArrowRightCircle className="h-4 w-4" /> </Button>
      <Button onClick={refreshScreenshot} variant="outline" size="sm" title="Refresh Screenshot" disabled={browserStatus !== 'ready' || isRefreshing}> <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> </Button>
      <Button onClick={() => setShowAxes(!showAxes)} variant="outline" size="sm" title={showAxes ? 'Hide Axes' : 'Show Axes'}> {showAxes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} </Button>
      <Button onClick={handleSaveScreenshot} variant="outline" size="sm" title="Save Screenshot to Local Path" disabled={browserStatus !== 'ready'}> <Frame className="h-4 w-4" /> </Button>
    </div>
  );

  return (
    <Card className="w-auto h-auto mx-auto bg-background">
      {browserStatus !== 'not-initialized' && (
        <CardHeader className='pt-1'>
          {renderTitleBarButtons()}
        </CardHeader>
      )}
      <CardContent className="p-0 w-full h-auto">
        {browserStatus === 'not-initialized' ? (
          <div className="flex flex-col items-center justify-center border rounded-lg w-full h-full">
            <div className="p-6 bg-background rounded-xl shadow-lg max-w-xs w-full text-center">
              <div className="space-y-4 mb-6">
                <Label htmlFor="viewport-preset" className="text-sm font-medium text-foreground/70">Viewport Preset</Label>
                <Select value={selectedPreset} onValueChange={(value) => handleViewportPresetChange(value as ViewportPresetKey)} disabled={browserStatus !== 'not-initialized'}>
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
              <Button onClick={handleInitialize} disabled={browserStatus !== 'not-initialized'} className="w-full rounded-md bg-primary hover:bg-primary/90 transition-colors">
                Initialize ({VIEWPORT_PRESETS[selectedPreset].width}×{VIEWPORT_PRESETS[selectedPreset].height})
              </Button>
            </div>
          </div>
        ) : screenshotData && imageDimensions ? (
          <div
            ref={interactionDivRef}
            tabIndex={0}
            className="relative rounded-md inline-block focus:outline-1 focus:outline-offset-1 focus:outline-white px-1"
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
              overflow: 'hidden',
            }}
          >
            <img src={screenshotData} alt="Browser Screenshot" className="w-full h-full object-contain rounded-md" />
            {showAxes && (
              <>
                <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md z-10">{viewportWidth} × {viewportHeight}</div>
                {cursorPosition && <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded z-10">X: {cursorPosition.x}px, Y: {cursorPosition.y}px</div>}
                {isRefreshing && <div className="absolute bottom-2 left-2 bg-blue-600 bg-opacity-70 text-white text-xs px-2 py-1 rounded z-10 animate-pulse"><Loader2 className="inline-block mr-1 h-3 w-3 animate-spin" /> Loading...</div>}
                <svg className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }} pointerEvents="none" viewBox={`0 0 ${viewportWidth} ${viewportHeight}`} preserveAspectRatio="none">
                  {widthPoints.map((x, index) => <line key={`x-${index}`} x1={x} y1={0} x2={x} y2={viewportHeight} stroke="rgba(255, 0, 0, 0.3)" strokeWidth="1" strokeDasharray="4,4" />)}
                  {heightPoints.map((y, index) => <line key={`y-${index}`} x1={0} y1={y} x2={viewportWidth} y2={y} stroke="rgba(0, 0, 255, 0.3)" strokeWidth="1" strokeDasharray="4,4" />)}
                  {widthPoints.map((x, index) => <text key={`x-label-${index}`} x={x} y={viewportHeight - 5} fill="rgba(255, 0, 0, 0.7)" fontSize="10" textAnchor="middle"> {Math.round(x).toFixed(0)} </text>)}
                  {heightPoints.map((y, index) => <text key={`y-label-${index}`} x={5} y={y + 3} fill="rgba(0, 0, 255, 0.7)" fontSize="10" textAnchor="start"> {Math.round(y).toFixed(0)} </text>)}
                </svg>
              </>
            )}
          </div>
        ) : (
          <></>
        )}
      </CardContent>
    </Card>
  );
};

export default MiniBrowser;
