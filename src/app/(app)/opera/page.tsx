'use client';

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect, useContext, useCallback } from 'react';
import React from 'react';
import MessageBubble from '@/components/message-display/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Hammer, Send, BrainCog, Power, PowerOff, Square } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot } from "lucide-react";

import useSWR from 'swr';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import { PlaywrightContext } from '@/context/PlaywrightContext';
import { CounterMessagesSchema, PlanStep } from '../api/opera/counterfeit/schemas';
import { generateId } from 'ai';

// Define a generic fetcher function for useSWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Opera() {
  const [apiRoute, setApiRoute] = useState<string>('/api/opera/counterfeit'); // State for API route
  const { messages, data, input, handleInputChange, handleSubmit, stop, status } = useChat({
    maxSteps: 3, // Consider if maxSteps should differ per route
    api: apiRoute, // Use state variable for API route
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['props', 'playwright']);
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

  const reconnectCooldownMs = 5000; // 5 seconds cooldown
  const lastReconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Automatically connect to SSH if SWR indicates disconnected and not currently connecting
  useEffect(() => {
    if (sshData && sshData.status === 'Disconnected' && !isConnecting) {
      const now = Date.now();
      if (now - lastReconnectAttemptRef.current > reconnectCooldownMs) {
        lastReconnectAttemptRef.current = now;
        handleSshToggle();
      } else if (!reconnectTimeoutRef.current) {
        // Schedule a retry after cooldown if not already scheduled
        const delay = reconnectCooldownMs - (now - lastReconnectAttemptRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          lastReconnectAttemptRef.current = Date.now();
          handleSshToggle();
        }, delay);
      }
    }
    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [sshData, isConnecting]);

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
        messages: [
          {
            id: generateId(),
            role: 'user',
            content: input,
            parts: [
              {
                type: 'text',
                text: input
              }
            ]
          }
        ],
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

  // --- Calculate Counterfeit Plan/Error State Outside the Loop ---
  const validatedData = React.useMemo(() => {
    if (apiRoute === '/api/opera/counterfeit' && Array.isArray(data) && data.length > 0) {
      const latestCounterfeitState = data[data.length - 1];
      const validationResult = CounterMessagesSchema.safeParse(latestCounterfeitState);

      if (validationResult.success) {
        // Return the entire validated data object
        // console.log("Opera Page: Valid counterfeit data received:", validationResult.data);
        return { type: 'success' as const, data: validationResult.data };
      } else {
        console.error("Opera Page: Invalid counterfeit data received:", validationResult.error.flatten());
        // Return an error object
        return { type: 'error' as const, message: "Failed to process or display the latest plan due to invalid data." };
      }
    }
    // Return null if not applicable
    return null;
  }, [data, apiRoute]); // Dependencies: run only when data or apiRoute changes

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
                <Toggle
                  pressed={apiRoute === '/api/opera/counterfeit'}
                  onPressedChange={(checked) => setApiRoute(checked ? '/api/opera/counterfeit' : '/api/opera/chat')}
                  className="ml-auto cursor-pointer"
                >
                  <BrainCog color={apiRoute === '/api/opera/counterfeit' ? 'cyan' : 'white'} />
                </Toggle>
              </header>

              {/* Messages Section - Takes remaining space, scrollable */}
              <div className="flex-1 overflow-auto">
                <ScrollArea className="h-full w-full px-3 pb-2">
                  <div className="space-y-2 h-full w-full">
                    {messages.map((m, index) => {
                      const isLastMessage = index === messages.length - 1;
                      if (isLastMessage && validatedData) {
                        if (validatedData.type === 'success') {
                          // Render all finalMessages as replacement for the last message
                          return validatedData.data.finalMessages.slice(1, validatedData.data.finalMessages.length).map((finalMsg, finalIndex) => (
                            <MessageBubble
                              key={finalMsg.id || `final-${finalIndex}`}
                              m={finalMsg as any} // Cast to any to bypass potential type mismatches
                              openStates={openStates}
                              expandedResults={expandedResults}
                              toggleOpen={toggleOpen}
                              toggleExpandResult={toggleExpandResult}
                              data={finalIndex === validatedData.data.finalMessages.length - 1 ? { plan: validatedData.data.plan } : undefined}
                              apiRoute={apiRoute}
                              isLastMessage={isLastMessage && finalIndex === validatedData.data.finalMessages.length - 1}
                            />
                          ));
                        } else if (validatedData.type === 'error') {
                          // Render error message for the last message
                          return (
                            <div key={`${m.id}-error`} className="flex items-start gap-2 w-full justify-start">
                              <Avatar className="border">
                                <AvatarFallback><Bot /></AvatarFallback>
                              </Avatar>
                              <div className="space-y-2 break-words overflow-hidden w-full bg-destructive/10 text-destructive rounded-lg p-3">
                                <p className="font-semibold text-sm mb-2">Error:</p>
                                <p className="text-xs">{validatedData.message}</p>
                              </div>
                            </div>
                          );
                        }
                      }
                      // Default rendering for all other messages or if no validatedData replacement
                      return (
                        <MessageBubble
                          key={m.id}
                          m={m}
                          openStates={openStates}
                          expandedResults={expandedResults}
                          toggleOpen={toggleOpen}
                          toggleExpandResult={toggleExpandResult}
                          data={undefined} // Pass undefined for plan data in default case
                          apiRoute={apiRoute}
                          isLastMessage={isLastMessage}
                        />
                      );
                    })}
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
                      <div className="flex space-x-2 items-center">
                        <Select value={selectedModel} onValueChange={handleModelChange}>
                          <SelectTrigger size='sm' className="w-auto h-8 text-xs px-2 focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map(model => (
                              <SelectItem className="text-xs" key={model.key} value={model.key}>{model.label}</SelectItem>
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
                      <div className="flex items-center">
                        <Tooltip>
                          <TooltipTrigger>
                            {status !== 'ready' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={stop}
                              >
                                <Square />
                              </Button>
                            ) : (
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={!input.trim() || status !== 'ready'}
                              >
                                <Send />
                              </Button>
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {status !== 'ready' ? 'Stop Generating' : 'Send Message'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
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
                      <TooltipTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 ml-2"
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
                    <div className="flex-grow"></div>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 ml-2"
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