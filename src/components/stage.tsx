import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Theater, TvMinimal } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import MiniBrowser from './mini-browser';

interface StageProps {
  className?: string;
  initialUrl?: string;
  initialViewport?: { width: number; height: number };
  autoInitializeBrowser?: boolean;
}

const DEFAULT_PERFORMANCE_URL = 'https://en.wikipedia.org/wiki/Main_Page';
const DEFAULT_BACKSTAGE_URL = '';
const DEFAULT_VIEWPORT = { width: 1024, height: 768 };

const Stage: React.FC<StageProps> = ({ 
  className, 
  initialUrl,
  initialViewport = DEFAULT_VIEWPORT,
  autoInitializeBrowser = false
}) => {
  const [view, setView] = useState<'performance' | 'backstage'>('performance');
  const [performanceUrl, setPerformanceUrl] = useState(initialUrl || DEFAULT_PERFORMANCE_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePerformanceUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPerformanceUrl(e.target.value);
  };
  const handlePerformanceUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIframeError(false);
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = performanceUrl;
    }
  };
  const handleRefresh = () => {
    setIframeError(false);
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = performanceUrl;
    }
  };
  const handleIframeLoad = () => setIsLoading(false);
  const handleIframeError = () => {
    setIframeError(true);
    setIsLoading(false);
  };

  const handleSwitchToBackstage = () => {
    setView('backstage');
  };

  return (
    <div className={`flex flex-col bg-muted rounded-lg h-full ${className || ''}`}>
      <div className="flex items-center justify-center gap-2 p-3 border-b bg-background">
        {view === 'performance' ? (
          <form onSubmit={handlePerformanceUrlSubmit} className="flex items-center gap-2 flex-1 max-w-2xl mx-auto">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              value={performanceUrl}
              onChange={handlePerformanceUrlChange}
              placeholder="Enter a URL to display in Performance view"
              onKeyDown={(e) => { if (e.key === 'Enter') handlePerformanceUrlSubmit(e); }}
            />
            <Button type="button" variant="outline" size="icon" onClick={handleRefresh} title="Refresh Performance View" disabled={isLoading}>
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={handleSwitchToBackstage} title="Switch to Backstage (Mini Browser)">
              <Theater className="h-5 w-5" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-1 max-w-2xl mx-auto justify-end">
            <Button type="button" variant="outline" size="icon" onClick={() => setView('performance')} title="Switch to Performance (IFrame View)">
              <TvMinimal className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 relative rounded-b-lg overflow-hidden">
        {/* Performance View Wrapper - Always rendered, visibility toggled */}
        <div style={{ display: view === 'performance' ? 'block' : 'none', height: '100%' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
              <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={performanceUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            referrerPolicy="no-referrer"
          />
          {iframeError && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center">
                <div className="flex flex-col items-center">
                  <span className="text-destructive mb-2">Could not display this website.</span>
                  <Button onClick={handleRefresh} variant="outline">Try Again</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Backstage View Wrapper - Always rendered, visibility toggled */}
        <div style={{ display: view === 'backstage' ? 'block' : 'none', height: '100%' }}>
          <div className="w-full h-full flex items-center justify-center p-1">
            <MiniBrowser />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stage;
