import React, { useState, useEffect, useRef, useContext } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, ArrowRightCircle, Eye, EyeOff, ChevronLeft, ChevronRight, X, Cookie, Loader2, Image as ImageIcon, Check, Trash2, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PlaywrightContext } from '@/context/PlaywrightContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dotted-dialog';

type BrowserStatus = 'not-initialized' | 'initializing' | 'ready' | 'error';

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
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [viewportHeight, setViewportHeight] = useState(768);
  const [selectedPreset, setSelectedPreset] = useState<ViewportPresetKey>('default');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [contextInput, setContextInput] = useState('opera');
  const [availableContexts, setAvailableContexts] = useState<{ id: string }[]>([]);
  const interactionDivRef = useRef<HTMLDivElement>(null);
  const [showAxes, setShowAxes] = useState(false);
  const [availablePages, setAvailablePages] = useState<{ id: string; contextId: string | null }[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const { setActivePage } = useContext(PlaywrightContext);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [pageToRename, setPageToRename] = useState<string | null>(null);
  const [newPageName, setNewPageName] = useState('');

  // Update the context whenever contextInput or selectedPageId changes
  useEffect(() => {
    setActivePage(contextInput, selectedPageId);
  }, [contextInput, selectedPageId, setActivePage]);

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
      const updatedParams = {
        ...params,
        contextId: contextInput || 'opera',
        pageId: selectedPageId || 'main'
      };
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...updatedParams }),
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
            body: JSON.stringify({ action: 'screenshot', contextId: contextInput || 'opera', pageId: selectedPageId || 'main' }),
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

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const checkBrowserStatus = async () => {
      if (browserStatus === 'not-initialized') {
        const response = await fetch('/api/playwright', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getStatus' })
        });
        const data = await response.json();
        if (data.success && data.status.browserInitialized) {
          setBrowserStatus('ready');
          // Set available pages from status
          if (data.status.pages) {
            setAvailablePages(data.status.pages);
            // Select the first page by default if available
            if (data.status.pages.length > 0 && !selectedPageId) {
              setSelectedPageId(data.status.pages[0].id);
              await fetchScreenshotForPage(data.status.pages[0].id);
            }
          }
          // Set available contexts from status
          if (data.status.contexts) {
            setAvailableContexts(data.status.contexts);
            // Set the first context as default if available
            if (data.status.contexts.length > 0 && contextInput === 'opera') {
              setContextInput(data.status.contexts[0].id);
            }
          }
          // Fetch viewport size
          const viewportRes = await fetch('/api/playwright', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getViewportSize' })
          });
          const viewportData = await viewportRes.json();
          if (viewportData.success && viewportData.viewport) {
            setViewportWidth(viewportData.viewport.width);
            setViewportHeight(viewportData.viewport.height);
          }
          // Fetch screenshot data
          const screenshotRes = await fetch('/api/playwright', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'screenshot' })
          });
          const screenshotDataPayload = await screenshotRes.json();
          if (screenshotDataPayload.success && screenshotDataPayload.data) {
            setScreenshotData(`data:image/png;base64,${screenshotDataPayload.data}`);
          }
          // Clear interval once browser is initialized
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } else if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    // Initial check
    checkBrowserStatus();
    // Set up interval to check every 5 seconds if not initialized
    if (browserStatus === 'not-initialized') {
      intervalId = setInterval(checkBrowserStatus, 5000);
    }
    // Cleanup interval on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [browserStatus, contextInput, selectedPageId]);

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
    const initResponse = await callPlaywrightAPI('init', { width: viewportWidth, height: viewportHeight, contextId: contextInput || 'opera' }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
    if (initResponse.success) {
      await callPlaywrightAPI('goto', { url: 'https://google.com', contextId: contextInput || 'opera', pageId: selectedPageId || 'main' }, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
    }
  };

  const handleCleanup = async () => {
    await callPlaywrightAPI('cleanup', {}, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus);
  };

  const refreshScreenshot = async () => {
    if (browserStatus === 'ready' && selectedPageId) {
      await fetchScreenshotForPage(selectedPageId);
    }
  };

  const fetchScreenshotForPage = async (pageId: string) => {
    setIsRefreshing(true);
    try {
      const screenshotRes = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'screenshot', contextId: contextInput || 'opera', pageId })
      });
      const screenshotDataPayload = await screenshotRes.json();
      if (screenshotDataPayload.success && screenshotDataPayload.data) {
        setScreenshotData(`data:image/png;base64,${screenshotDataPayload.data}`);
        if (screenshotDataPayload.viewport) {
          setViewportWidth(screenshotDataPayload.viewport.width);
          setViewportHeight(screenshotDataPayload.viewport.height);
        }
      }
    } catch (error) {
      console.error('Error fetching screenshot:', error);
    } finally {
      setIsRefreshing(false);
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
      body: JSON.stringify({ action: 'getCookies', url: urlInput || 'https://google.com', contextId: contextInput || 'opera' })
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

  const handleCreateNewPageWithUrl = async () => {
    if (!urlInput || browserStatus !== 'ready') return;
    const contextId = contextInput || 'opera';
    const pageId = `page-${Date.now()}`;
    const response = await fetch('/api/playwright', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'createPage', 
        contextId, 
        pageId, 
        url: urlInput || 'https://google.com',
        width: viewportWidth,
        height: viewportHeight
      })
    });
    const data = await response.json();
    if (data.success) {
      // Refresh the list of pages
      const statusRes = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getStatus' })
      });
      const statusData = await statusRes.json();
      if (statusData.success && statusData.status.pages) {
        setAvailablePages(statusData.status.pages);
      }
      // Set the newly created page as selected and fetch its screenshot
      setSelectedPageId(pageId);
      await fetchScreenshotForPage(pageId);
    }
  };

  const handlePageSelect = async (pageId: string) => {
    setSelectedPageId(pageId);
    await fetchScreenshotForPage(pageId);
  };

  const handleDeletePage = async (pageId: string) => {
    if (browserStatus !== 'ready') return;
    setIsDeleting(true);
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deletePage', pageId, contextId: contextInput || 'opera' })
      });
      const data = await response.json();
      if (data.success) {
        // Refresh the list of pages
        const statusRes = await fetch('/api/playwright', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getStatus' })
        });
        const statusData = await statusRes.json();
        if (statusData.success && statusData.status.pages) {
          setAvailablePages(statusData.status.pages);
          // If the deleted page was selected, select another page or clear selection
          if (selectedPageId === pageId) {
            const newSelectedPage = statusData.status.pages.length > 0 ? statusData.status.pages[0].id : null;
            setSelectedPageId(newSelectedPage);
            if (newSelectedPage) {
              await fetchScreenshotForPage(newSelectedPage);
            } else {
              setScreenshotData(null);
            }
          }
        }
      } else {
        console.error('Failed to delete page:', data.message);
      }
    } catch (error) {
      console.error('Error deleting page:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenRenameDialog = (pageId: string) => {
    setPageToRename(pageId);
    setNewPageName(pageId);
    setRenameDialogOpen(true);
  };

  const handleRenamePage = async () => {
    if (browserStatus !== 'ready' || !pageToRename || !newPageName) return;
    try {
      const response = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'renamePage', 
          pageId: pageToRename, 
          newPageId: newPageName, 
          contextId: contextInput || 'opera' 
        })
      });
      const data = await response.json();
      if (data.success) {
        // Refresh the list of pages
        const statusRes = await fetch('/api/playwright', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getStatus' })
        });
        const statusData = await statusRes.json();
        if (statusData.success && statusData.status.pages) {
          setAvailablePages(statusData.status.pages);
          // Update selected page ID if it was renamed
          if (selectedPageId === pageToRename) {
            setSelectedPageId(newPageName);
            await fetchScreenshotForPage(newPageName);
          }
        }
        setRenameDialogOpen(false);
        setPageToRename(null);
        setNewPageName('');
      } else {
        console.error('Failed to rename page:', data.message);
      }
    } catch (error) {
      console.error('Error renaming page:', error);
    }
  };

  const renderTitleBarButtons = () => (
    <div className="flex items-center gap-2">
      <Button onClick={() => callPlaywrightAPI('goBack', {}, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus)} variant="outline" size="sm" title="Go Back" disabled={browserStatus !== 'ready'}> <ChevronLeft className="h-4 w-4" /> </Button>
      <Button onClick={() => callPlaywrightAPI('goForward', {}, setIsRefreshing, setScreenshotData, setViewportWidth, setViewportHeight, setBrowserStatus)} variant="outline" size="sm" title="Go Forward" disabled={browserStatus !== 'ready'}> <ChevronRight className="h-4 w-4" /> </Button>
      <Button onClick={handleGetCookies} variant="outline" size="sm" title="Get Cookies for Current/Input URL" disabled={browserStatus !== 'ready'}> <Cookie className="h-4 w-4" /> </Button>
      <Button onClick={handleCleanup} disabled={browserStatus === 'not-initialized' || browserStatus === 'initializing'} variant="outline" size="sm" title="Cleanup Browser Instance"> <Trash2 className="h-4 w-4" /> </Button>
      <div className="flex-grow max-w-md mx-auto flex items-center gap-2">
        <Select value={contextInput} onValueChange={setContextInput} disabled={browserStatus !== 'ready'}>
          <SelectTrigger size='sm' className="w-auto text-sm px-2 focus:ring-0 focus:ring-offset-0">
            <SelectValue placeholder="Context" />
          </SelectTrigger>
          <SelectContent>
            {availableContexts.map(context => (
              <SelectItem key={context.id} value={context.id}>{context.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Enter URL (e.g., google.com)" className="flex-1 h-8" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} disabled={browserStatus !== 'ready'} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNewPageWithUrl(); }} />
      </div>
      <Button onClick={handleCreateNewPageWithUrl} variant="outline" size="sm" title="Create New Page with URL" disabled={browserStatus !== 'ready' || !urlInput}> <ArrowRightCircle className="h-4 w-4" /> </Button>
      <Button onClick={refreshScreenshot} variant="outline" size="sm" title="Refresh Screenshot" disabled={browserStatus !== 'ready' || isRefreshing}> <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> </Button>
      <Button onClick={() => setShowAxes(!showAxes)} variant="outline" size="sm" title={showAxes ? 'Hide Axes' : 'Show Axes'}> {showAxes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} </Button>
      <Button onClick={handleSaveScreenshot} variant="outline" size="sm" title="Save Screenshot to Local Path" disabled={browserStatus !== 'ready'}> <ImageIcon className="h-4 w-4" /> </Button>
    </div>
  );

  const renderPagesRow = () => {
    if (availablePages.length === 0) return null;
    return (
      <div className="flex w-full border-t gap-1 py-1 overflow-x-auto">
        {availablePages.map(page => (
          <div
            key={page.id}
            className={`flex flex-1 text-center text-xs px-2 py-1 rounded-md cursor-pointer border border-border/60 justify-center items-center ${selectedPageId === page.id ? 'bg-muted' : 'bg-muted/20 hover:bg-muted/60'} min-w-[150px]`}
            title={`${page.contextId || 'unknown'} - ${page.id}`}
            onClick={() => {
              handlePageSelect(page.id);
              if (selectedPageId === page.id) {
                handleOpenRenameDialog(page.id);
              }
            }}
          >
            <span className="truncate flex-1">{`${page.contextId || 'unknown'} - ${page.id}`}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 p-0 ml-1" 
              onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
              disabled={browserStatus !== 'ready' || isDeleting || availablePages.length <= 1}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="mx-auto bg-background ">
      {browserStatus !== 'not-initialized' && screenshotData && (
        <CardHeader className='pt-1'>
          {renderTitleBarButtons()}
          {renderPagesRow()}
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
            className="relative rounded-md inline-block px-1"
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
          <div className="flex flex-col items-center justify-center border rounded-lg w-full h-full">
            <div className="p-6 bg-background rounded-xl shadow-lg max-w-xs w-full text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-sm text-foreground/70">Loading browser screenshot...</p>
            </div>
          </div>
        )}
      </CardContent>
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Label htmlFor="newPageName">New Page Name</Label>
            <Input 
              id="newPageName" 
              value={newPageName} 
              onChange={(e) => setNewPageName(e.target.value)} 
              placeholder="Enter new page name" 
            />
            <Button onClick={handleRenamePage} disabled={!newPageName || browserStatus !== 'ready'}>
              <Check className="h-4 w-4 mr-2" /> Rename
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MiniBrowser;
