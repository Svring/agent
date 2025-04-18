import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface StageProps {
  className?: string;
  initialUrl?: string;
}

// Predefined websites that allow iframe embedding
const ALLOWED_SITES = [
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
];

const Stage: React.FC<StageProps> = ({ className, initialUrl }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    // If initialUrl is one of our allowed sites, use it
    if (initialUrl) {
      const matchedSite = ALLOWED_SITES.find(site => site.url === initialUrl);
      if (matchedSite) {
        handleNavigate(matchedSite.url);
      }
    }
  }, [initialUrl]);

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

  return (
    <div className={`flex flex-col bg-muted rounded-lg ${className}`}>
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
    </div>
  );
};

export default Stage;
