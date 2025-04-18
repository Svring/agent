'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button'; // Assuming shadcn/ui
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface InteractiveScreenshotProps {
  className?: string;
  refreshInterval?: number; // Optional: interval in ms to auto-refresh
}

const InteractiveScreenshot: React.FC<InteractiveScreenshotProps> = ({
  className,
  refreshInterval,
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // --- Fetch Screenshot ---
  const fetchScreenshot = useCallback(async () => {
    if (isLoading) return; // Prevent overlapping requests
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
        console.log('Screenshot updated.');
      } else {
        throw new Error(result.message || 'Failed to fetch screenshot');
      }
    } catch (err: any) {
      console.error('Screenshot fetch error:', err);
      setError(err.message || 'Could not load browser view.');
      setImgSrc(null); // Clear image on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Initial Load & Auto-Refresh ---
  useEffect(() => {
    fetchScreenshot(); // Initial fetch

    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchScreenshot, refreshInterval);
      return () => clearInterval(intervalId); // Cleanup interval
    }
  }, [fetchScreenshot, refreshInterval]); // Dependencies

  // --- Handle Click ---
  const handleImageClick = async (event: React.MouseEvent<HTMLImageElement>) => {
    if (isInteracting) return; // Prevent rapid clicks

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    
    // IMPORTANT: Coordinate Scaling (if needed)
    // If the displayed image size differs from the backend viewport, scale here.
    // Example (assuming you know viewportWidth/Height and rendered img width/height):
    // const renderedWidth = event.currentTarget.offsetWidth;
    // const renderedHeight = event.currentTarget.offsetHeight;
    // const targetX = Math.round((offsetX / renderedWidth) * viewportWidth);
    // const targetY = Math.round((offsetY / renderedHeight) * viewportHeight);
    
    // --- Assuming 1:1 mapping for now --- 
    // This assumes the backend viewport size matches the rendered image size.
    // You might need to adjust this based on actual viewport and rendered sizes.
    const targetX = Math.round(offsetX); 
    const targetY = Math.round(offsetY);
    // -------------------------------------

    console.log(`Image clicked at: (${offsetX.toFixed(0)}, ${offsetY.toFixed(0)}), sending coords: (${targetX}, ${targetY})`);

    setIsInteracting(true);
    setError(null);
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'click', x: targetX, y: targetY }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Click action failed');
      }
      console.log('Click action successful via API.');
      // Fetch a new screenshot to show the result
      await fetchScreenshot();
    } catch (err: any) {
      console.error('Click interaction error:', err);
      setError(err.message || 'Interaction failed.');
    } finally {
      setIsInteracting(false);
    }
  };

  return (
    <div className={`relative bg-muted rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => fetchScreenshot()} // Corrected onClick handler
            disabled={isLoading || isInteracting}
            title="Refresh Screenshot"
           >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
      </div>

      {/* Loading State */}
      {isLoading && !imgSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
         <div className="absolute inset-0 flex items-center justify-center bg-red-100 z-20 p-4">
             <div className="text-center text-red-700">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <p className='font-semibold'>Error</p>
                <p className="text-sm">{error}</p>
             </div>
         </div>
      )}

      {/* Image Display */}
      {imgSrc && (
        <img
          ref={imageRef}
          src={imgSrc}
          alt="Browser Screenshot"
          onClick={handleImageClick}
          className={`w-full h-full object-contain cursor-crosshair ${isInteracting ? 'opacity-50' : ''}`} // Use object-contain
          style={{ imageRendering: 'pixelated' }} // Optional: Better for sharp UI elements
          draggable={false}
        />
      )}
      
      {/* Placeholder if no image and not loading/error */}
      {!imgSrc && !isLoading && !error && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Initializing browser view...</p>
          </div>
      )}
    </div>
  );
};

export default InteractiveScreenshot; 