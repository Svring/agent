'use client';

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect, useContext, useCallback } from 'react';
import React from 'react';
import MessageBubble from '@/components/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Hammer, Send, Image, Power, PowerOff, Square } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import useSWR from 'swr';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import { PlaywrightContext } from '@/context/PlaywrightContext';

// Define a generic fetcher function for useSWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Opera() {
  const { messages, input, handleInputChange, handleSubmit, stop, isLoading } = useChat({
    maxSteps: 3,
    api: '/api/opera',
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['props']);
  const [availableModels, setAvailableModels] = useState<{ key: string, label: string }[]>([]);
  const [availableTools, setAvailableTools] = useState<{ key: string, label: string }[]>([]);
  // SSH state managed by SWR effect
  const [sshStatus, setSshStatus] = useState<{ connected: boolean, cwd: string | null }>({ connected: false, cwd: null });
  const [isConnecting, setIsConnecting] = useState(false);
  // Browser status state - still using useEffect for now
  const [browserStatus, setBrowserStatus] = useState<{ initialized: boolean, viewport: { width: number, height: number } | null, url: string | null }>({ initialized: false, viewport: null, url: null });
  const [isBrowserLoading, setIsBrowserLoading] = useState(false);
  // State for Playwright active page
  const [activeContextId, setActiveContextId] = useState<string>('opera');
  const [activePageId, setActivePageId] = useState<string | null>('main');

  // --- SWR Hooks ---
  const { data: castingData, error: castingError } = useSWR<{
    models: { key: string, label: string }[];
    tools: { key: string, label: string }[];
  }>('/api/casting', fetcher);

  const { data: sshData, error: sshError } = useSWR<{
    status: 'Connected' | 'Disconnected';
    cwd: string | null;
    credentials: any; // Use specific type if needed
  }>('/api/props', fetcher, { refreshInterval: 5000 });
  // --- End SWR Hooks ---

  const setActivePage = useCallback((contextId: string, pageId: string | null) => {
    setActiveContextId(contextId);
    setActivePageId(pageId);
  }, []);

  const toggleOpen = (key: string) => {
    setOpenStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExpandResult = (key: string) => {
    setExpandedResults(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      (messagesEndRef.current as HTMLElement).scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Effect to update casting options state from SWR data
  useEffect(() => {
    if (castingData) {
      setAvailableModels(castingData.models || []);
      setAvailableTools(castingData.tools || []);
      // Set default model only if it hasn't been set yet and models are available
      if (!selectedModel && castingData.models && castingData.models.length > 0) {
        const defaultModelKey = castingData.models.find((m) => m.key === 'grok-3-latest')
          ? 'grok-3-latest'
          : castingData.models[0].key; // Fallback to the first available model
        setSelectedModel(defaultModelKey);
      }
    }
    if (castingError) {
      console.error('Error fetching casting options via SWR:', castingError);
    }
  }, [castingData, castingError, selectedModel]);

  // Effect to update SSH status state from SWR data
  useEffect(() => {
    if (sshData) {
      const newStatus = {
        connected: sshData.status === 'Connected',
        cwd: sshData.cwd
      };
      // Only update state if it actually changed to prevent unnecessary re-renders
      if (newStatus.connected !== sshStatus.connected || newStatus.cwd !== sshStatus.cwd) {
        setSshStatus(newStatus);
      }
    } else if (sshError) {
      console.error('Error fetching SSH status via SWR:', sshError);
      // Ensure status reflects disconnection on error
      if (sshStatus.connected) {
         setSshStatus({ connected: false, cwd: null });
      }
    }
  }, [sshData, sshError, sshStatus]); // Include sshStatus to compare previous state

  // Automatically connect to SSH if SWR indicates disconnected and not currently connecting
  useEffect(() => {
    if (sshData && sshData.status === 'Disconnected' && !isConnecting) {
      console.log('SWR detected SSH disconnected, attempting to connect...');
      handleSshToggle();
    }
    // No dependency array change needed here, logic depends on sshData and isConnecting state
  }, [sshData, isConnecting]); // Rerun when sshData or isConnecting changes

  // Fetch browser status periodically (keeping useEffect for this one)
  const fetchBrowserStatus = useCallback(async () => {
    try {
      // Get browser status (initialized, etc)
      const statusRes = await fetch('/api/playwright', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getStatus' }) });
      let initialized = false;
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        initialized = statusData.status?.browserInitialized;
      }
      // Get viewport size
      let viewport = null;
      let url = null;
      if (initialized) {
        const viewportRes = await fetch('/api/playwright', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getViewportSize' }) });
        if (viewportRes.ok) {
          const viewportData = await viewportRes.json();
          viewport = viewportData.viewport || null;
        }
        // Try to get current URL (from playwright-manager, not directly available, so skip for now or add if available)
      }
      setBrowserStatus({ initialized, viewport, url });
    } catch (error) {
      console.error('Error fetching browser status:', error);
      setBrowserStatus({ initialized: false, viewport: null, url: null });
    }
  }, []); // Keep useCallback dependency array empty if it doesn't depend on changing props/state

  useEffect(() => {
    fetchBrowserStatus();
    // Automatically initialize browser if not initialized
    if (!browserStatus.initialized && !isBrowserLoading) {
      handleBrowserInit();
    }
    const intervalId = setInterval(fetchBrowserStatus, 5000);
    return () => clearInterval(intervalId);
    // Ensure dependencies are correct, might need browserStatus.initialized, isBrowserLoading, handleBrowserInit
  }, [fetchBrowserStatus, browserStatus.initialized, isBrowserLoading]);

  // Handle SSH Connection Toggle
  const handleSshToggle = async () => {
    setIsConnecting(true);
    const action = sshStatus.connected ? 'disconnect' : 'initialize';
    try {
      const response = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to ${action} SSH:`, errorData.message);
        // Optionally show an error message to the user
      } else {
        console.log(`SSH ${action} successful`);
        // Immediately fetch status after action
        await fetchBrowserStatus();
      }
    } catch (error) {
      console.error(`Error during SSH ${action}:`, error);
      // Optionally show an error message to the user
    } finally {
      setIsConnecting(false);
    }
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  const customHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e, {
      body: {
        model: selectedModel,
        tools: selectedTools,
        customInfo: `The current active page is Context: ${activeContextId}, Page: ${activePageId || 'unknown'}.`
      }
    });
  };

  // Playwright browser initialize/cleanup handlers
  const handleBrowserInit = async () => {
    setIsBrowserLoading(true);
    try {
      // Use default viewport or 1024x768
      const width = browserStatus.viewport?.width || 1024;
      const height = browserStatus.viewport?.height || 768;
      await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init', width, height })
      });
      await fetchBrowserStatus();
    } finally {
      setIsBrowserLoading(false);
    }
  };

  const handleBrowserCleanup = async () => {
    setIsBrowserLoading(true);
    try {
      await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' })
      });
      await fetchBrowserStatus();
    } finally {
      setIsBrowserLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <style jsx>{`
        .animate-glow {
          box-shadow: 0 0 2px #22c55e, 0 0 4px #22c55e;
        }
      `}</style>
      <PlaywrightContext.Provider value={{ contextId: activeContextId, pageId: activePageId, setActivePage }}>
        <ResizablePanelGroup
          direction="horizontal"
          className="w-full h-full rounded-lg"
        >
          {/* Left sidebar - resizable, defaulting to 30% */}
          <ResizablePanel defaultSize={30} minSize={30} maxSize={50}>
            <div className="h-full flex flex-col">
              {/* Title Bar - Fixed height, always at top */}
              <header className="flex items-center px-3 py-2 shrink-0">
                <SidebarTrigger />
                <p className="flex-1 text-lg font-serif text-center"> Opera </p>
              </header>

              {/* Messages Section - Takes remaining space, scrollable */}
              <div className="flex-1 overflow-auto">
                <ScrollArea className="h-full w-full px-3 pb-2">
                  <div className="space-y-2 h-full w-full">
                    {messages.map(m => (
                      <MessageBubble
                        key={m.id}
                        m={m}
                        openStates={openStates}
                        expandedResults={expandedResults}
                        toggleOpen={toggleOpen}
                        toggleExpandResult={toggleExpandResult}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Input Section - Fixed height, always at bottom */}
              <footer className="p-2 border-t shrink-0">
                <div className="flex w-full flex-col rounded-lg border shadow-sm">
                  <form onSubmit={customHandleSubmit} className="flex flex-col w-full bg-background rounded-lg p-2">
                    <Textarea
                      className="flex-1 resize-none border-0 px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-lg mb-2"
                      placeholder="What's on your mind?"
                      value={input}
                      onChange={handleInputChange}
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          customHandleSubmit(e);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        <Select value={selectedModel} onValueChange={handleModelChange}>
                          <SelectTrigger size='sm' className="w-auto h-8 text-sm px-2 focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map(model => (
                              <SelectItem key={model.key} value={model.key}>{model.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <MultiSelect
                          label="tools"
                          icon={Hammer}
                          options={availableTools.map(tool => ({ label: tool.label, value: tool.key }))}
                          selectedOptions={selectedTools}
                          setSelectedOptions={setSelectedTools}
                        />
                      </div>
                      {/* Conditionally render Send or Stop button using isLoading */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {isLoading ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8" // Keep size consistent
                              onClick={stop}
                              disabled={!isLoading} // Button is enabled only when isLoading is true
                            >
                              <Square />
                            </Button>
                          ) : (
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 " // Keep size consistent
                              disabled={!input.trim() || isLoading} // Disable when input is empty OR loading
                            >
                              <Send />
                            </Button>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {isLoading ? 'Stop Generating' : 'Send Message'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </form>
                  {/* SSH Status Bar */}
                  <div className="flex items-center h-auto px-2 text-xs text-muted-foreground rounded">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${sshStatus.connected ? 'bg-green-600 animate-glow' : 'bg-gray-400'}`}
                      title={sshStatus.connected ? 'SSH Connected' : 'SSH Disconnected'}
                    />
                    <span className="mr-1 shrink-0">SSH Terminal</span>
                    <span className="mr-1 shrink-0">-</span>
                    <span className="mr-1 shrink-0">{sshStatus.connected ? 'Connected' : 'Disconnected'}</span>
                    {sshStatus.connected && sshStatus.cwd && (
                      <>
                        <span className="mr-1 shrink-0">-</span>
                        <span className="truncate" title={sshStatus.cwd}>{sshStatus.cwd}</span>
                      </>
                    )}
                    <div className="flex-grow"></div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 p-0 ml-2"
                          onClick={handleSshToggle}
                          disabled={isConnecting || isLoading} // Also disable if AI is loading
                        >
                          {sshStatus.connected
                            ? <PowerOff />
                            : <Power />
                          }
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {sshStatus.connected ? 'Disconnect SSH' : 'Connect SSH'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {/* Browser Status Bar */}
                  <div className="flex items-center h-auto px-2 text-xs text-muted-foreground mb-2 rounded">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${browserStatus.initialized ? 'bg-green-600 animate-glow' : 'bg-gray-400'}`}
                      title={browserStatus.initialized ? 'Browser Initialized' : 'Browser Not Initialized'}
                    />
                    <span className="mr-1 shrink-0">Browser</span>
                    <span className="mr-1 shrink-0">-</span>
                    <span className="mr-1 shrink-0">{browserStatus.initialized ? 'Initialized' : 'Not Initialized'}</span>
                    {browserStatus.initialized && browserStatus.viewport && (
                      <>
                        <span className="mr-1 shrink-0">-</span>
                        <span className="truncate" title={`Viewport: ${browserStatus.viewport.width}x${browserStatus.viewport.height}`}>{browserStatus.viewport.width}×{browserStatus.viewport.height}</span>
                      </>
                    )}
                    {/* Optionally add URL if available in the future */}
                    <div className="flex-grow"></div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 p-0 ml-2"
                          onClick={browserStatus.initialized ? handleBrowserCleanup : handleBrowserInit}
                          disabled={isBrowserLoading || isLoading} // Use isLoading here too
                        >
                          {browserStatus.initialized
                            ? <PowerOff />
                            : <Power />
                          }
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {browserStatus.initialized ? 'Cleanup Browser' : 'Initialize Browser'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </footer>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-0.5 bg-muted transition-colors duration-200" />

          {/* Right stage area - Render Stage component conditionally */}
          <ResizablePanel defaultSize={70}>
            <div className="h-full p-2">
              <Stage className="h-full w-full" />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </PlaywrightContext.Provider>
    </TooltipProvider>
  );
}