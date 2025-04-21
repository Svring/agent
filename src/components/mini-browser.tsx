import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, ArrowRightCircle, Eye, EyeOff, ChevronLeft, ChevronRight, Frame, Cookie } from 'lucide-react';

interface CoordinatesProps {
  screenshotData: string | null;
  viewportWidth: number;
  viewportHeight: number;
  onRefresh: () => Promise<void>;
}

const Coordinates: React.FC<CoordinatesProps> = ({ screenshotData, viewportWidth, viewportHeight, onRefresh }) => {
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const interactionDivRef = useRef<HTMLDivElement>(null);
  const [showAxes, setShowAxes] = useState(true);

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
      const x = Math.round((e.clientX - rect.left) * (imageDimensions.width / rect.width));
      const y = Math.round((e.clientY - rect.top) * (imageDimensions.height / rect.height));
      setCursorPosition({ x, y });
    }
  };

  const handleMouseLeave = () => {
    setCursorPosition(null);
  };

  const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // Only proceed if the interaction div is focused
    if (document.activeElement !== interactionDivRef.current) return;

    // Prevent click event from firing immediately on double click
    if (e.detail === 1) {
      if (imageDimensions && cursorPosition) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) * (imageDimensions.width / rect.width));
        const y = Math.round((e.clientY - rect.top) * (imageDimensions.height / rect.height));
        try {
          const response = await fetch('/api/playwright', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'click',
              x,
              y
            }),
          });
          const data = await response.json();
          if (data.success) {
            console.log(`Click performed at (${x}, ${y})`);
            setIsRefreshing(true);
            await onRefresh();
            setIsRefreshing(false);
          } else {
            console.error('Click action failed:', data.message);
          }
        } catch (error) {
          console.error('Error performing click:', error);
          setIsRefreshing(false);
        }
        // Focus the div after click logic is done
        interactionDivRef.current?.focus();
      }
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // Only proceed if the interaction div is focused
    if (document.activeElement !== interactionDivRef.current) return;

    if (imageDimensions && cursorPosition) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (imageDimensions.width / rect.width));
      const y = Math.round((e.clientY - rect.top) * (imageDimensions.height / rect.height));
      try {
        const response = await fetch('/api/playwright', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'doubleClick',
            x,
            y
          }),
        });
        const data = await response.json();
        if (data.success) {
          console.log(`DoubleClick performed at (${x}, ${y})`);
          setIsRefreshing(true);
          await onRefresh();
          setIsRefreshing(false);
        } else {
          console.error('DoubleClick action failed:', data.message);
        }
      } catch (error) {
        console.error('Error performing double click:', error);
        setIsRefreshing(false);
      }
    }
  };

  const handleWheel = async (e: React.WheelEvent<HTMLDivElement>) => {
    // Only proceed if the interaction div is focused
    if (document.activeElement !== interactionDivRef.current) return;

    e.preventDefault(); // Prevent default browser scroll
    const deltaX = e.deltaX;
    const deltaY = e.deltaY;
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scroll',
          deltaX,
          deltaY
        }),
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Scroll performed: (${deltaX}, ${deltaY})`);
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
      } else {
        console.error('Scroll action failed:', data.message);
      }
    } catch (error) {
      console.error('Error performing scroll:', error);
      setIsRefreshing(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    // This handler implicitly requires focus, but we can add the check for consistency
    if (document.activeElement !== interactionDivRef.current) return;

    e.preventDefault(); // Prevent default browser behavior for keys like arrows
    const key = e.key;
    console.log('Key pressed:', key);
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pressKey',
          key: key
        }),
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Key press sent: ${key}`);
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
      } else {
        console.error(`Key press action failed for ${key}:`, data.message);
      }
    } catch (error) {
      console.error(`Error performing key press for ${key}:`, error);
      setIsRefreshing(false);
    }
  };

  if (!screenshotData || !imageDimensions) {
    return null;
  }

  // Dynamically adjust the number of grid lines based on resolution
  const targetInterval = 100;
  const numWidthLines = Math.max(2, Math.round(imageDimensions.width / targetInterval));
  const numHeightLines = Math.max(2, Math.round(imageDimensions.height / targetInterval));
  const widthInterval = imageDimensions.width / (numWidthLines - 1);
  const heightInterval = imageDimensions.height / (numHeightLines - 1);

  // Calculate proportional coordinates
  const widthPoints = Array.from({ length: numWidthLines }, (_, i) => i * widthInterval);
  const heightPoints = Array.from({ length: numHeightLines }, (_, i) => i * heightInterval);

  return (
    <Card className="w-fit mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button
            onClick={async () => await fetch('/api/playwright', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'goBack' }) }).then(() => onRefresh())}
            variant="outline"
            size="sm"
            title="Go Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={async () => await fetch('/api/playwright', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'goForward' }) }).then(() => onRefresh())}
            variant="outline"
            size="sm"
            title="Go Forward"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            onClick={async () => {
              const response = await fetch('/api/playwright', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'getCookies',
                  url: 'https://hzh.sealos.run/?s=bd-sealos-marketing-appstore'
                })
              });
              const data = await response.json();
              if (data.success) {
                console.log('Cookies:', data.cookies);
              } else {
                console.error('Failed to get cookies:', data.message);
              }
            }}
            variant="outline"
            size="sm"
            title="Get Cookies"
          >
            <Cookie className="h-4 w-4" />
          </Button>
          <div className="flex-grow max-w-md mx-auto">
            <Input
              placeholder="Enter URL"
              className="w-full h-8"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
          </div>
          <Button
            onClick={async () => await fetch('/api/playwright', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'goto', url: urlInput || 'https://example.com' }) }).then(() => onRefresh())}
            variant="outline"
            size="sm"
            title="Go to URL"
          >
            <ArrowRightCircle className="h-4 w-4" />
          </Button>
          <Button
            onClick={onRefresh}
            variant="outline"
            size="sm"
            title="Refresh Screenshot"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setShowAxes(!showAxes)}
            variant="outline"
            size="sm"
            title={showAxes ? 'Hide Axes' : 'Show Axes'}
          >
            {showAxes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={interactionDivRef}
          tabIndex={0}
          className="relative border rounded-md inline-block focus:outline-2 focus:outline-offset-2 focus:outline-white/75"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          style={{ cursor: 'crosshair' }}
        >
          <img
            src={screenshotData}
            alt="Browser Screenshot with Coordinates"
            className="w-full rounded-md"
            style={{ height: 'auto' }}
          />
          {/* Conditionally render overlays and SVG for drawing axes */}
          {showAxes && (
            <>
              {/* Overlay for resolution */}
              <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                {viewportWidth} × {viewportHeight}
              </div>
              {/* Overlay for cursor coordinates */}
              {cursorPosition && (
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  X: {cursorPosition.x}px, Y: {cursorPosition.y}px
                </div>
              )}
              {/* Overlay for refreshing indicator */}
              {isRefreshing && (
                <div className="absolute top-2 left-40 bg-blue-500 bg-opacity-70 text-white text-xs px-2 py-1 rounded animate-pulse">
                  Refreshing...
                </div>
              )}
              <svg
                className="absolute inset-0"
                style={{ width: '100%', height: '100%' }}
                pointerEvents="none"
                viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                preserveAspectRatio="none"
              >
                {/* X-axis lines */}
                {widthPoints.map((x, index) => (
                  <line
                    key={`x-${index}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={imageDimensions.height}
                    stroke="rgba(255, 0, 0, 0.3)"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                ))}
                {/* Y-axis lines */}
                {heightPoints.map((y, index) => (
                  <line
                    key={`y-${index}`}
                    x1={0}
                    y1={y}
                    x2={imageDimensions.width}
                    y2={y}
                    stroke="rgba(0, 0, 255, 0.3)"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                ))}
                {/* Labels for X-axis */}
                {widthPoints.map((x, index) => (
                  <text
                    key={`x-label-${index}`}
                    x={x}
                    y={imageDimensions.height - 5}
                    fill="rgba(255, 0, 0, 0.8)"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {Math.round(x).toFixed(0)}px
                  </text>
                ))}
                {/* Labels for Y-axis */}
                {heightPoints.map((y, index) => (
                  <text
                    key={`y-label-${index}`}
                    x={5}
                    y={y + 3}
                    fill="rgba(0, 0, 255, 0.8)"
                    fontSize="10"
                    textAnchor="start"
                  >
                    {Math.round(y).toFixed(0)}px
                  </text>
                ))}
              </svg>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Coordinates;
