'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button'; // Assuming shadcn/ui
import { RefreshCw, AlertTriangle, MousePointer, Maximize, Minimize } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface InteractiveScreenshotProps {
  className?: string;
  refreshInterval?: number; // Optional: interval in ms to auto-refresh
  initialViewport?: { width: number; height: number };
  autoInitialize?: boolean; // Whether to automatically initialize the browser
}

// Common device viewport presets
const VIEWPORT_PRESETS = {
  'desktop': { width: 1920, height: 1080, label: 'Desktop (1920×1080)' },
  'laptop': { width: 1366, height: 768, label: 'Laptop (1366×768)' },
  'tablet': { width: 768, height: 1024, label: 'Tablet (768×1024)' },
  'mobile': { width: 375, height: 667, label: 'Mobile (375×667)' },
  'default': { width: 1024, height: 768, label: 'Default (1024×768)' },
};

type ViewportPresetKey = keyof typeof VIEWPORT_PRESETS;

const InteractiveScreenshot: React.FC<InteractiveScreenshotProps> = ({
  className,
  refreshInterval,
  initialViewport,
  autoInitialize = true,
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{x: number, y: number} | null>(null);
  const [browserStatus, setBrowserStatus] = useState<'initializing' | 'running' | 'error' | 'not-started'>('not-started');
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport state
  const [viewportWidth, setViewportWidth] = useState(initialViewport?.width || 1024);
  const [viewportHeight, setViewportHeight] = useState(initialViewport?.height || 768); 
  const [selectedPreset, setSelectedPreset] = useState<ViewportPresetKey>('default');
  const [isChangingViewport, setIsChangingViewport] = useState(false);

  // --- Fetch Screenshot ---
  const fetchScreenshot = useCallback(async () => {
    if (isLoading || browserStatus !== 'running') return; // Prevent overlapping requests or fetching when browser not ready
    
    setIsLoading(true);
    setError(null);
    console.log('Fetching screenshot...');
    
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'screenshot' }),
      });
      const result = await response.json();
      if (response.ok && result.success && result.data) {
        setImgSrc(`data:image/png;base64,${result.data}`);
        // Update viewport state if returned from API and different from current
        if (result.viewport && 
            (result.viewport.width !== viewportWidth || 
             result.viewport.height !== viewportHeight)) {
          console.log(`Viewport size updated from API: ${result.viewport.width}x${result.viewport.height}`);
          setViewportWidth(result.viewport.width);
          setViewportHeight(result.viewport.height);
          
          // Find preset if it matches
          const matchingPreset = Object.entries(VIEWPORT_PRESETS).find(
            ([_, preset]) => 
              preset.width === result.viewport.width && 
              preset.height === result.viewport.height
          );
          
          if (matchingPreset) {
            setSelectedPreset(matchingPreset[0] as ViewportPresetKey);
          } else {
            setSelectedPreset('default'); // Reset to default if no match
          }
        }
        console.log('Screenshot updated.');
      } else {
        throw new Error(result.message || 'Failed to fetch screenshot');
      }
    } catch (err: any) {
      console.error('Screenshot fetch error:', err);
      setError(err.message || 'Could not load browser view.');
      setImgSrc(null); // Clear image on error
      
      // If we get an error about browser not initialized, update status
      if (err.message && err.message.includes('Browser not initialized')) {
        setBrowserStatus('not-started');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, browserStatus, viewportWidth, viewportHeight]);

  // --- Initialize Browser ---
  const initializeBrowser = useCallback(async () => {
    if (browserStatus === 'initializing' || browserStatus === 'running') return;
    
    setBrowserStatus('initializing');
    setError(null);
    
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'init',
          width: viewportWidth,
          height: viewportHeight
        }),
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        // Update viewport state if returned from API
        if (result.viewport) {
          // Only update if different to avoid loops
          if (result.viewport.width !== viewportWidth || result.viewport.height !== viewportHeight) {
            console.log(`Updating viewport from initialization: ${result.viewport.width}x${result.viewport.height}`);
            setViewportWidth(result.viewport.width);
            setViewportHeight(result.viewport.height);
            
            // Find preset if it matches
            const matchingPreset = Object.entries(VIEWPORT_PRESETS).find(
              ([_, preset]) => 
                preset.width === result.viewport.width && 
                preset.height === result.viewport.height
            );
            
            if (matchingPreset) {
              setSelectedPreset(matchingPreset[0] as ViewportPresetKey);
            }
          }
        }
        
        setBrowserStatus('running');
        console.log('Browser initialized successfully.');
        
        // Fetch screenshot after initialization, giving a short delay
        // to allow browser to stabilize and avoid race conditions
        setTimeout(() => {
          fetchScreenshot();
        }, 100);
      } else {
        throw new Error(result.message || 'Failed to initialize browser');
      }
    } catch (err: any) {
      console.error('Browser initialization error:', err);
      setError(err.message || 'Failed to initialize browser.');
      setBrowserStatus('error');
    }
  }, [viewportWidth, viewportHeight, browserStatus, fetchScreenshot]);

  // --- Change Viewport Size ---
  const changeViewportSize = useCallback(async (width: number, height: number) => {
    // Skip if the viewport size hasn't changed
    if (width === viewportWidth && height === viewportHeight) {
      console.log(`Viewport size already set to ${width}x${height}, skipping change`);
      return;
    }
    
    if (browserStatus !== 'running') {
      // If browser not running, just update the state
      setViewportWidth(width);
      setViewportHeight(height);
      return;
    }
    
    setIsChangingViewport(true);
    setError(null);
    
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'setViewportSize', 
          width, 
          height 
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setViewportWidth(result.viewport.width);
        setViewportHeight(result.viewport.height);
        console.log(`Viewport size changed to ${width}x${height}`);
        await fetchScreenshot(); // Refresh screenshot after viewport change
      } else {
        throw new Error(result.message || 'Failed to change viewport size');
      }
    } catch (err: any) {
      console.error('Viewport change error:', err);
      setError(err.message || 'Could not change viewport size.');
    } finally {
      setIsChangingViewport(false);
    }
  }, [fetchScreenshot, browserStatus, viewportWidth, viewportHeight]);

  // --- Handle viewport preset change ---
  const handleViewportPresetChange = useCallback((value: ViewportPresetKey) => {
    setSelectedPreset(value);
    const preset = VIEWPORT_PRESETS[value];
    changeViewportSize(preset.width, preset.height);
  }, [changeViewportSize]);

  // --- Auto Initialize on component mount ---
  useEffect(() => {
    if (autoInitialize && browserStatus === 'not-started') {
      initializeBrowser();
    }
    
    // Cleanup on unmount
    return () => {
      // Close browser context if this component initialized it
      if (autoInitialize && browserStatus === 'running') {
        fetch('/api/playwright', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cleanup' }),
        }).catch(err => console.error('Error cleaning up browser:', err));
      }
    };
  }, [autoInitialize, browserStatus, initializeBrowser]);

  // --- Initial Load & Auto-Refresh ---
  useEffect(() => {
    // Only set up refresh interval if browser is running
    if (browserStatus === 'running' && refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchScreenshot, refreshInterval);
      return () => clearInterval(intervalId); // Cleanup interval
    }
  }, [fetchScreenshot, refreshInterval, browserStatus]); // Dependencies

  // --- Initialize viewport on first load ---
  useEffect(() => {
    const initializeViewport = async () => {
      if (initialViewport && browserStatus === 'running' && 
          (initialViewport.width !== viewportWidth || initialViewport.height !== viewportHeight)) {
        console.log(`Initializing viewport to ${initialViewport.width}x${initialViewport.height}`);
        await changeViewportSize(initialViewport.width, initialViewport.height);
      }
    };
    
    initializeViewport();
  }, [initialViewport, browserStatus, changeViewportSize, viewportWidth, viewportHeight]);

  // --- Scale coordinates helper ---
  const getScaledCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!imageRef.current) return { x: 0, y: 0 };

    const rect = imageRef.current.getBoundingClientRect();
    const dispW = rect.width;
    const dispH = rect.height;

    // Position inside the displayed <img> in CSS pixels
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    // Prevent negative / over‑bounds values (e.g. mouse over letter‑boxed area)
    const clampedX = Math.max(0, Math.min(offsetX, dispW));
    const clampedY = Math.max(0, Math.min(offsetY, dispH));

    // Percentage position inside the displayed bitmap
    const percentX = clampedX / dispW;
    const percentY = clampedY / dispH;

    // Map those percentages to the original viewport size (Playwright expects CSS px of viewport)
    const cssX = Math.round(percentX * viewportWidth);
    const cssY = Math.round(percentY * viewportHeight);

    return { x: cssX, y: cssY };
  }, [viewportWidth, viewportHeight]);

  // --- Helper: map viewport coords back to display coords (for cursor / indicator) ---
  const toDisplayCoords = useCallback((coords: {x: number; y: number}) => {
    if (!imageRef.current) return { left: 0, top: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    const dispW = rect.width;
    const dispH = rect.height;

    const percentX = coords.x / viewportWidth;
    const percentY = coords.y / viewportHeight;

    return {
      left: percentX * dispW,
      top: percentY * dispH,
    };
  }, [viewportWidth, viewportHeight]);

  // --- Mouse events handler ---
  const handleMouseInteraction = useCallback(async (action: 'click' | 'dblclick' | 'down' | 'up' | 'move', event: React.MouseEvent, button: 'left' | 'right' | 'middle' = 'left') => {
    if (!isFocused || isInteracting || browserStatus !== 'running') return;
    
    const coords = getScaledCoordinates(event.clientX, event.clientY);
    console.log(`Mouse ${action} at: (${event.clientX}, ${event.clientY}), sending coords: (${coords.x}, ${coords.y})`);
    
    if (action === 'move') {
      setCursorPosition(coords);
      return; // Don't send API requests for mouse moves to reduce traffic
    }

    setIsInteracting(true);
    setError(null);
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: action === 'dblclick' ? 'doubleClick' : action === 'down' ? 'mouseDown' : action === 'up' ? 'mouseUp' : 'click', 
          x: coords.x, 
          y: coords.y,
          button
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || `${action} action failed`);
      }
      console.log(`${action} action successful via API.`);
      
    } catch (err: any) {
      console.error(`${action} interaction error:`, err);
      setError(err.message || 'Interaction failed.');
    } finally {
      setIsInteracting(false);
    }
  }, [isFocused, isInteracting, browserStatus, getScaledCoordinates]);

  // --- Keyboard events handler ---
  const handleKeyPress = useCallback(async (event: KeyboardEvent) => {
    if (!isFocused || isInteracting || browserStatus !== 'running') return;
    
    event.preventDefault();
    console.log(`Key pressed: ${event.key}`);
    
    setIsInteracting(true);
    setError(null);
    
    try {
      // Determine if this is a special key or text input
      // Special keys like Enter, Tab, ArrowKeys, etc. use pressKey
      // Regular text input uses typeText
      const isSpecialKey = event.key.length > 1 || event.ctrlKey || event.altKey || event.metaKey;
      
      const apiAction = isSpecialKey ? 'pressKey' : 'typeText';
      const payload = isSpecialKey ? 
        { action: apiAction, key: event.key } : 
        { action: apiAction, text: event.key };
      
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Keyboard action failed');
      }
      
      console.log('Keyboard action successful via API.');
      await fetchScreenshot();
    } catch (err: any) {
      console.error('Keyboard interaction error:', err);
      setError(err.message || 'Keyboard interaction failed.');
    } finally {
      setIsInteracting(false);
    }
  }, [isFocused, isInteracting, browserStatus, fetchScreenshot]);

  // --- Scroll handler ---
  const handleScroll = useCallback(async (event: WheelEvent) => {
    if (!isFocused || isInteracting || browserStatus !== 'running') return;
    
    event.preventDefault();
    console.log(`Scroll delta: (${event.deltaX}, ${event.deltaY})`);
    
    setIsInteracting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'scroll', 
          deltaX: event.deltaX, 
          deltaY: event.deltaY 
        }),
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Scroll action failed');
      }
      
      console.log('Scroll action successful via API.');
      await fetchScreenshot();
    } catch (err: any) {
      console.error('Scroll interaction error:', err);
      setError(err.message || 'Scroll interaction failed.');
    } finally {
      setIsInteracting(false);
    }
  }, [isFocused, isInteracting, browserStatus, fetchScreenshot]);

  // --- Context menu handler ---
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (isFocused && browserStatus === 'running') {
      event.preventDefault();
      handleMouseInteraction('click', event, 'right');
    }
  }, [isFocused, browserStatus, handleMouseInteraction]);

  // --- Register event listeners when focused ---
  useEffect(() => {
    if (!isFocused || !containerRef.current || browserStatus !== 'running') return;
    
    const container = containerRef.current;
    
    // Keyboard event handler
    const keyDownHandler = (e: KeyboardEvent) => handleKeyPress(e);
    
    // Scroll event handler
    const wheelHandler = (e: WheelEvent) => handleScroll(e);
    
    // Add event listeners
    window.addEventListener('keydown', keyDownHandler);
    container.addEventListener('wheel', wheelHandler);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', keyDownHandler);
      container.removeEventListener('wheel', wheelHandler);
    };
  }, [isFocused, browserStatus, handleKeyPress, handleScroll]);

  // --- Handle simple click ---
  const handleClick = (event: React.MouseEvent<HTMLImageElement>) => {
    handleMouseInteraction('click', event);
  };

  // --- Handle double click ---
  const handleDoubleClick = (event: React.MouseEvent<HTMLImageElement>) => {
    handleMouseInteraction('dblclick', event);
  };

  // --- Handle mouse down ---
  const handleMouseDown = (event: React.MouseEvent<HTMLImageElement>) => {
    if (event.button === 0) { // Left button only
      handleMouseInteraction('down', event);
    }
  };

  // --- Handle mouse up ---
  const handleMouseUp = (event: React.MouseEvent<HTMLImageElement>) => {
    if (event.button === 0) { // Left button only
      handleMouseInteraction('up', event);
    }
  };

  // --- Handle mouse move ---
  const handleMouseMove = (event: React.MouseEvent<HTMLImageElement>) => {
    if (isFocused && browserStatus === 'running') {
      handleMouseInteraction('move', event);
    }
  };

  // --- Manual refresh handler ---
  const handleManualRefresh = () => {
    if (browserStatus === 'running') {
      fetchScreenshot();
    } else {
      initializeBrowser();
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative bg-muted rounded-lg overflow-hidden ${isFocused ? 'ring-2 ring-primary' : ''} ${className}`}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onContextMenu={handleContextMenu}
    >
      {/* Top controls bar */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-background/70 backdrop-blur-sm px-2 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Viewport preset selector */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Select
                  value={selectedPreset}
                  onValueChange={(value) => handleViewportPresetChange(value as ViewportPresetKey)}
                  disabled={isChangingViewport || isLoading || browserStatus !== 'running'}
                >
                  <SelectTrigger className="h-7 w-40 text-xs bg-background/80">
                    <SelectValue placeholder="Select viewport" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VIEWPORT_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>
                <p>Change viewport size</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Current dimensions display */}
          <div className="text-xs text-muted-foreground bg-background/40 px-2 py-0.5 rounded">
            {viewportWidth} × {viewportHeight}
          </div>
        </div>
        
        {/* Right side controls */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7" 
                  onClick={handleManualRefresh}
                  disabled={isLoading || isInteracting || browserStatus === 'initializing'}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading || browserStatus === 'initializing' ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{browserStatus === 'running' ? 'Refresh view' : 'Initialize browser'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Focus indicator */}
      {isFocused && browserStatus === 'running' && (
        <div className="absolute top-10 left-2 z-30 bg-primary/80 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
          <MousePointer className="h-3 w-3" />
          <span>Browser Control Active</span>
        </div>
      )}

      {/* Initializing State */}
      {browserStatus === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-20">
          <div className="flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mb-2"></div>
            <p className="text-muted-foreground">Initializing browser...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {(error || browserStatus === 'error') && (
         <div className="absolute inset-0 flex items-center justify-center bg-red-100 z-20 p-4">
             <div className="text-center text-red-700">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <p className='font-semibold'>Error</p>
                <p className="text-sm">{error || 'Browser initialization failed.'}</p>
                <Button 
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={initializeBrowser}
                >
                  Try Again
                </Button>
             </div>
         </div>
      )}

      {/* Not Started State */}
      {browserStatus === 'not-started' && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/90 z-20 p-4">
          <div className="text-center">
            <MousePointer className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className='font-semibold'>Browser Not Started</p>
            <p className="text-sm text-muted-foreground">Initialize the browser to interact with web content.</p>
            <Button 
              className="mt-2"
              onClick={initializeBrowser}
            >
              Initialize Browser
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && browserStatus === 'running' && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
        </div>
      )}

      {/* Image Display */}
      {imgSrc && browserStatus === 'running' && (
        <div className="flex justify-center items-center w-full h-full mt-9">
          <img
            ref={imageRef}
            src={imgSrc}
            alt="Browser Screenshot"
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className={`max-w-full max-h-full object-contain ${isFocused ? 'cursor-none' : 'cursor-default'} ${isInteracting ? 'opacity-50' : ''}`}
            style={{ 
              imageRendering: 'pixelated',
              aspectRatio: `${viewportWidth}/${viewportHeight}`,
            }}
            draggable={false}
            width={viewportWidth}
            height={viewportHeight}
          />
          {/* Custom cursor when focused */}
          {isFocused && cursorPosition && (
            <div 
              className="absolute pointer-events-none z-10 w-5 h-5 flex items-center justify-center"
              style={{
                left: toDisplayCoords(cursorPosition).left,
                top: toDisplayCoords(cursorPosition).top,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="w-5 h-5 text-black">
                <MousePointer className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Placeholder if no image and no specific state indicators */}
      {!imgSrc && !isLoading && !error && browserStatus === 'running' && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Initializing browser view...</p>
          </div>
      )}

      {/* Click to focus message when not focused */}
      {!isFocused && imgSrc && !isLoading && !error && browserStatus === 'running' && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
            Click to enable browser control
          </div>
        </div>
      )}

      {/* Viewport size changing overlay */}
      {isChangingViewport && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-background p-4 rounded-lg shadow-lg flex flex-col items-center">
            <Maximize className="h-8 w-8 mb-2 animate-pulse text-primary" />
            <p className="text-sm">Changing viewport size...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveScreenshot; 