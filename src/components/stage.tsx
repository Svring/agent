import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink, AlertTriangle, Play, Image as ImageIcon, MousePointerClick, Eye } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InteractiveScreenshot from './interactive-screenshot';

interface StageProps {
  className?: string;
  initialUrl?: string;
}

// Predefined websites that allow iframe embedding
const ALLOWED_SITES = [
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
];

const Stage: React.FC<StageProps> = ({ className, initialUrl }) => {
  // State for Browser Tab
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // State for Test API Tab
  const [testUrl, setTestUrl] = useState('https://www.google.com');
  const [clickX, setClickX] = useState('100');
  const [clickY, setClickY] = useState('100');
  const [apiResult, setApiResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);

  useEffect(() => {
    // If initialUrl is one of our allowed sites, use it for the iframe
    if (initialUrl) {
      const matchedSite = ALLOWED_SITES.find(site => site.url === initialUrl);
      if (matchedSite) {
        handleNavigate(matchedSite.url);
      }
    }
  }, [initialUrl]);

  // --- Browser Tab Logic ---
  const handleNavigate = (siteUrl: string) => {
    if (!siteUrl) return;
    
    setIsLoading(true);
    setIframeError(false);
    setUrl(siteUrl);
  };

  const handleRefresh = () => {
    if (!url) return;
    setIsLoading(true);
    setIframeError(false);
    const currentUrl = url;
    setUrl('');
    setTimeout(() => setUrl(currentUrl), 100);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIframeError(true);
    setIsLoading(false);
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
    callPlaywrightApi({ action: 'goto', url: testUrl });
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

  return (
    <div className={`flex flex-col bg-muted rounded-lg ${className}`}>
      <Tabs defaultValue="browser" className="flex flex-col h-full">
        <TabsList className="m-2">
          <TabsTrigger value="browser">Browser</TabsTrigger>
          <TabsTrigger value="test-api">Test API</TabsTrigger>
          <TabsTrigger value="interactive">Interactive View</TabsTrigger>
        </TabsList>

        {/* Browser Tab Content */}
        <TabsContent value="browser" className="flex-1 flex flex-col mt-0">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 flex-wrap">
              {ALLOWED_SITES.map((site) => (
                <Button
                  key={site.name}
                  variant={url === site.url ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleNavigate(site.url)}
                  className="min-w-20"
                >
                  {site.name}
                </Button>
              ))}
              
              <div className="ml-auto flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleRefresh}
                  disabled={!url}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                
                {url && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => window.open(url, '_blank')}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
      
          <div className="flex-1 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
                <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
              </div>
            )}
            
            {url ? (
              <>
                <iframe 
                  src={url}
                  className="w-full h-full border-0"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  referrerPolicy="no-referrer"
                  style={{ display: iframeError ? 'none' : 'block' }}
                />
                
                {iframeError && !isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <Alert className="max-w-md">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Unable to display this website</AlertTitle>
                      <AlertDescription>
                        <p className="mb-2">This site appears to block being displayed in embedded frames.</p>
                        <Button 
                          onClick={() => window.open(url, '_blank')}
                          className="mt-2"
                        >
                          Open in New Tab <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Web Browser</h2>
                  <p className="text-muted-foreground mb-4">Select a website from the options above</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Test API Tab Content */}
        <TabsContent value="test-api" className="flex-1 flex flex-col mt-0 p-4 space-y-4 overflow-auto">
            <h3 className="text-lg font-semibold">Playwright API Test</h3>
            
            {/* Go To Action */}
            <div className="flex items-end gap-2">
                <div className="flex-grow">
                    <Label htmlFor="test-url">URL</Label>
                    <Input id="test-url" value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder="https://example.com" />
                </div>
                <Button onClick={handleTestGoto} disabled={isTesting || !testUrl}><Play className="mr-2 h-4 w-4" /> Go To</Button>
            </div>

            {/* Click Action */}
            <div className="flex items-end gap-2">
                <div className="w-24">
                    <Label htmlFor="click-x">X Coord</Label>
                    <Input id="click-x" type="number" value={clickX} onChange={(e) => setClickX(e.target.value)} placeholder="100" />
                </div>
                 <div className="w-24">
                    <Label htmlFor="click-y">Y Coord</Label>
                    <Input id="click-y" type="number" value={clickY} onChange={(e) => setClickY(e.target.value)} placeholder="100" />
                </div>
                <Button onClick={handleTestClick} disabled={isTesting}><MousePointerClick className="mr-2 h-4 w-4" /> Click</Button>
            </div>

            {/* Screenshot Action */}
            <div>
                <Button onClick={handleTestScreenshot} disabled={isTesting}><ImageIcon className="mr-2 h-4 w-4" /> Take Screenshot</Button>
            </div>

            {/* API Result Area */}
            <div className="flex-1 border rounded-md p-3 bg-background min-h-[150px]">
                <h4 className="font-semibold mb-2">API Result:</h4>
                {isTesting && (
                    <div className="flex items-center text-muted-foreground">
                        <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent mr-2"></div>
                        Loading...
                    </div>
                )}
                {apiResult && (
                    <pre className={`text-sm p-2 rounded ${apiResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {JSON.stringify(apiResult, null, 2)}
                    </pre>
                )}
                {screenshotData && (
                    <div className="mt-4 border-t pt-4">
                        <h5 className="font-semibold mb-2">Screenshot Preview:</h5>
                        <img src={screenshotData} alt="API Screenshot" className="max-w-full h-auto border rounded" />
                    </div>
                )}
                {!isTesting && !apiResult && <p className="text-sm text-muted-foreground">Perform an action to see the result.</p>}
            </div>
        </TabsContent>

        {/* Interactive View Tab Content */}
        <TabsContent value="interactive" className="flex-1 mt-0 p-0">
            <InteractiveScreenshot className="w-full h-full" refreshInterval={10000} />
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default Stage;
