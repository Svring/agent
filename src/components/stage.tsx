import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Theater, TvMinimal, Play, Image as ImageIcon, MousePointerClick, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InteractiveScreenshot from './curtain';

interface StageProps {
  className?: string;
  initialUrl?: string;
  initialViewport?: { width: number; height: number };
  autoInitializeBrowser?: boolean; // Whether this component should initialize the browser
}

const DEFAULT_PERFORMANCE_URL = 'https://en.wikipedia.org/wiki/Main_Page';
const DEFAULT_BACKSTAGE_URL = '';
const DEFAULT_VIEWPORT = { width: 1024, height: 768 };

const Stage: React.FC<StageProps> = ({ 
  className, 
  initialUrl,
  initialViewport = DEFAULT_VIEWPORT,
  autoInitializeBrowser = true // Default to true for standalone usage
}) => {
  // View state: 'performance' or 'backstage'
  const [view, setView] = useState<'performance' | 'backstage'>('performance');
  // URL states
  const [performanceUrl, setPerformanceUrl] = useState(initialUrl || DEFAULT_PERFORMANCE_URL);
  const [backstageUrl, setBackstageUrl] = useState(DEFAULT_BACKSTAGE_URL);
  // Iframe loading state
  const [isLoading, setIsLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // State for Test API Tab
  const [testUrl, setTestUrl] = useState('https://www.google.com');
  const [clickX, setClickX] = useState('100');
  const [clickY, setClickY] = useState('100');
  const [apiResult, setApiResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);

  // State for Backstage
  const [backstageLoading, setBackstageLoading] = useState(false);
  const [backstageError, setBackstageError] = useState<string | null>(null);
  const [browserInitialized, setBrowserInitialized] = useState(false);

  // Initialize browser on component mount only if autoInitializeBrowser is true
  useEffect(() => {
    if (!autoInitializeBrowser) return; // Skip initialization if prop is false
    
    const initBrowser = async () => {
      try {
        setBackstageLoading(true);
        const response = await fetch('/api/playwright', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'init',
            width: initialViewport.width,
            height: initialViewport.height
          }),
        });
        
        const result = await response.json();
        if (response.ok && result.success) {
          console.log('Browser initialized with viewport:', result.viewport);
          setBrowserInitialized(true);
          
          // Navigate to initial URL if in backstage view
          if (view === 'backstage' && initialUrl) {
            await fetch('/api/playwright', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'goto',
                url: initialUrl,
                width: initialViewport.width,
                height: initialViewport.height
              }),
            });
          }
        } else {
          console.error('Browser initialization failed:', result.message);
          setBackstageError(result.message || 'Failed to initialize browser');
        }
      } catch (err: any) {
        console.error('Browser initialization error:', err);
        setBackstageError(err.message || 'Failed to initialize browser');
      } finally {
        setBackstageLoading(false);
      }
    };
    
    initBrowser();
    
    // Cleanup on unmount - only if we initialized the browser
    return () => {
      if (!autoInitializeBrowser) return; // Skip cleanup if we didn't initialize
      
      // Close browser context
      fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' }),
      }).catch(err => console.error('Error cleaning up browser:', err));
    };
  }, [initialViewport, view, initialUrl, autoInitializeBrowser]);

  // Handlers for performance view
  const handlePerformanceUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPerformanceUrl(e.target.value);
  };
  const handlePerformanceUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIframeError(false);
    setIsLoading(true);
    // Force reload by resetting src
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

  // Handlers for backstage view
  const handleBackstageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackstageUrl(e.target.value);
  };
  const handleBackstageUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackstageLoading(true);
    setBackstageError(null);
    let urlToGo = backstageUrl.trim();
    if (urlToGo && !/^https?:\/\//i.test(urlToGo)) {
      urlToGo = 'https://' + urlToGo;
    }
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'goto', 
          url: urlToGo,
          width: initialViewport.width,
          height: initialViewport.height
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to navigate to URL');
      }
    } catch (err: any) {
      setBackstageError(err.message || 'Navigation failed.');
    } finally {
      setBackstageLoading(false);
    }
  };

  // --- Test API Tab Logic ---
  const callPlaywrightApi = async (body: any) => {
    setIsTesting(true);
    setApiResult(null);
    setScreenshotData(null);
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setApiResult(result);
      if (result.success && body.action === 'screenshot' && result.data) {
        setScreenshotData(`data:image/png;base64,${result.data}`);
      }
    } catch (error) {
      console.error("API Call Error:", error);
      setApiResult({ success: false, message: error instanceof Error ? error.message : 'An unknown error occurred' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestGoto = () => {
    callPlaywrightApi({ 
      action: 'goto', 
      url: testUrl,
      width: initialViewport.width,
      height: initialViewport.height
    });
  };

  const handleTestClick = () => {
    const x = parseInt(clickX, 10);
    const y = parseInt(clickY, 10);
    if (isNaN(x) || isNaN(y)) {
        setApiResult({success: false, message: "Invalid coordinates. Please enter numbers."} );
        return;
    }
    callPlaywrightApi({ action: 'click', x, y });
  };

  const handleTestScreenshot = () => {
    callPlaywrightApi({ action: 'screenshot' });
  };

  // Handle view switching
  const handleSwitchToBackstage = () => {
    setView('backstage');
    // Initialize browser if not already done and we're responsible for initialization
    if (!browserInitialized && autoInitializeBrowser) {
      fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'init',
          width: initialViewport.width,
          height: initialViewport.height
        }),
      }).then(res => res.json())
        .then(data => {
          if (data.success) {
            setBrowserInitialized(true);
          }
        })
        .catch(err => console.error('Error initializing browser:', err));
    }
  };

  return (
    <div className={`flex flex-col bg-muted rounded-lg h-full ${className || ''}`}>
      {/* Top input and controls */}
      <div className="flex items-center justify-center gap-2 p-3 border-b bg-background">
        {view === 'performance' ? (
          <form onSubmit={handlePerformanceUrlSubmit} className="flex items-center gap-2 flex-1 max-w-2xl mx-auto">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              value={performanceUrl}
              onChange={handlePerformanceUrlChange}
              placeholder="Enter a URL to display"
            />
            <Button type="button" variant="outline" size="icon" onClick={handleRefresh} title="Refresh" disabled={isLoading}>
              <RefreshCw className="h-5 w-5" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={handleSwitchToBackstage} title="Switch to Backstage">
              <Theater className="h-5 w-5" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleBackstageUrlSubmit} className="flex items-center gap-2 flex-1 max-w-2xl mx-auto">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              value={backstageUrl}
              onChange={handleBackstageUrlChange}
              placeholder="Backstage URL (for future use)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBackstageUrlSubmit(e);
                }
              }}
              disabled={backstageLoading}
            />
            <Button type="submit" variant="outline" size="icon" disabled={backstageLoading} title="Go to URL">
              <RefreshCw className={`h-5 w-5 ${backstageLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => setView('performance')} title="Switch to Performance">
              <TvMinimal className="h-5 w-5" />
            </Button>
          </form>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 relative">
        {view === 'performance' ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
                <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={performanceUrl}
              className="w-full h-full border-0 rounded-b-lg"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              referrerPolicy="no-referrer"
              style={{ display: iframeError ? 'none' : 'block' }}
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
          </>
        ) : (
          <div className="w-full h-full">
            <InteractiveScreenshot 
              className="w-full h-full" 
              refreshInterval={10000} 
              initialViewport={initialViewport}
              autoInitialize={autoInitializeBrowser}
            />
          </div>
        )}
      </div>

      {/* Backstage Error Message */}
      {backstageError && (
        <div className="text-destructive text-sm text-center mt-1">{backstageError}</div>
      )}
    </div>
  );
};

export default Stage;
