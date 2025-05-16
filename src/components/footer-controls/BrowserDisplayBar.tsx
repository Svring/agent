import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Power, PowerOff, Loader2 } from 'lucide-react';

interface BrowserStatus {
  initialized: boolean;
  viewport: { width: number; height: number } | null;
  url: string | null; 
}

export interface BrowserDisplayBarProps {
  browserStatus: BrowserStatus;
  isBrowserLoading: boolean;
  handleBrowserInit: () => void;
  handleBrowserCleanup: () => void;
}

const BrowserDisplayBar: React.FC<BrowserDisplayBarProps> = ({
  browserStatus,
  isBrowserLoading,
  handleBrowserInit,
  handleBrowserCleanup,
}) => {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center h-auto px-2 text-xs text-muted-foreground mb-2 rounded">
        <span
          className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${
            browserStatus.initialized ? 'bg-green-600 animate-glow' : 'bg-gray-400'
          }`}
          title={browserStatus.initialized ? 'Browser Initialized' : 'Browser Not Initialized'}
        />
        <span className="mr-1 shrink-0">Browser</span>
        <span className="mr-1 shrink-0">-</span>
        <span className="mr-1 shrink-0">
          {isBrowserLoading 
            ? (browserStatus.initialized ? 'Cleaning up...' : 'Initializing...') 
            : (browserStatus.initialized ? 'Initialized' : 'Not Initialized')}
        </span>
        {browserStatus.initialized && browserStatus.viewport && (
          <>
            <span className="mr-1 shrink-0">-</span>
            <span className="truncate" title={`Viewport: ${browserStatus.viewport.width}x${browserStatus.viewport.height}`}>
              {browserStatus.viewport.width}×{browserStatus.viewport.height}
            </span>
          </>
        )}
        <div className="flex-grow"></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 ml-2"
              onClick={browserStatus.initialized ? handleBrowserCleanup : handleBrowserInit}
              disabled={isBrowserLoading}
            >
              {isBrowserLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : browserStatus.initialized ? (
                <PowerOff className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isBrowserLoading 
                ? (browserStatus.initialized ? 'Cleaning up browser...' : 'Initializing browser...') 
                : (browserStatus.initialized ? 'Cleanup Browser' : 'Initialize Browser')}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default BrowserDisplayBar;