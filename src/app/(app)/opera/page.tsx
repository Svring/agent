'use client';

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect, useContext, useCallback } from 'react';
import React from 'react';
import MessageBubble from '@/components/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Hammer, Send, Image, Power, PowerOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import { PlaywrightContext } from '@/context/PlaywrightContext';

export default function Opera() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    maxSteps: 3,
    api: '/api/opera',
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState<string>(''); // Initialize as empty
  const [selectedTools, setSelectedTools] = useState<string[]>(['props']);
  const [availableModels, setAvailableModels] = useState<{ key: string, label: string }[]>([]);
  const [availableTools, setAvailableTools] = useState<{ key: string, label: string }[]>([]);
  const [sshStatus, setSshStatus] = useState<{ connected: boolean, cwd: string | null }>({ connected: false, cwd: null });
  const [isConnecting, setIsConnecting] = useState(false);
  // Browser status state
  const [browserStatus, setBrowserStatus] = useState<{ initialized: boolean, viewport: { width: number, height: number } | null, url: string | null }>({ initialized: false, viewport: null, url: null });
  const [isBrowserLoading, setIsBrowserLoading] = useState(false);
  // State for Playwright active page
  const [activeContextId, setActiveContextId] = useState<string>('opera');
  const [activePageId, setActivePageId] = useState<string | null>('main');

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

  // Fetch casting options (Models and Tools)
  useEffect(() => {
    const fetchCastingOptions = async () => {
      try {
        const response = await fetch('/api/casting');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models);
          setAvailableTools(data.tools);
          // Set default model to 'claude-3-5-sonnet-latest' if available, otherwise the first one
          if (data.models.length > 0 && !selectedModel) {
            const defaultModelKey = data.models.find((m: { key: string, label: string }) => m.key === 'claude-3-5-sonnet-latest')
              ? 'claude-3-5-sonnet-latest'
              : data.models[0].key; // Fallback to the first available model
            setSelectedModel(defaultModelKey);
          }
        } else {
          console.error('Failed to fetch casting options');
        }
      } catch (error) {
        console.error('Error fetching casting options:', error);
      }
    };
    fetchCastingOptions();
  }, [selectedModel]); // Add selectedModel dependency if you want to refetch or adjust logic based on it

  // Fetch SSH status periodically
  const fetchSshStatus = async () => {
    try {
      const response = await fetch('/api/props');
      if (response.ok) {
        const data = await response.json();
        setSshStatus({ connected: data.status === 'Connected', cwd: data.cwd });
      } else {
        console.error('Failed to fetch SSH status');
        setSshStatus({ connected: false, cwd: null }); // Assume disconnected on error
      }
    } catch (error) {
      console.error('Error fetching SSH status:', error);
      setSshStatus({ connected: false, cwd: null }); // Assume disconnected on error
    }
  };

  // Fetch browser status periodically
  const fetchBrowserStatus = async () => {
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
      setBrowserStatus({ initialized: false, viewport: null, url: null });
    }
  };

  useEffect(() => {
    fetchSshStatus();
    // Automatically connect to SSH if not connected
    if (!sshStatus.connected && !isConnecting) {
      handleSshToggle();
    }
    const intervalId = setInterval(fetchSshStatus, 5000); // Fetch every 5 seconds
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchBrowserStatus();
    // Automatically initialize browser if not initialized
    if (!browserStatus.initialized && !isBrowserLoading) {
      handleBrowserInit();
    }
    const intervalId = setInterval(fetchBrowserStatus, 5000);
    return () => clearInterval(intervalId);
  }, []);

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
        await fetchSshStatus();
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
          <ResizablePanel defaultSize={30} minSize={29} maxSize={50}>
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
                      <button
                        type="submit"
                        className="bg-none rounded-full"
                        disabled={!input.trim()}
                      >
                        <Send />
                      </button>
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
                          disabled={isConnecting}
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
                          disabled={isBrowserLoading}
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