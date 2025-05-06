'use client';

import { useChat, type Message } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect, useCallback } from 'react';
import React from 'react';
import MessageBubble from '@/components/message-display/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Hammer, Send, BrainCog, Power, PowerOff, Square, Bot } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import useSWR from 'swr';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import { PlaywrightContext } from '@/context/PlaywrightContext';
import { CounterMessagesSchema, PlanStep } from '@/app/(app)/api/opera/counterfeit/schemas';
import { generateId } from 'ai';
import { getSessionMessagesForChat } from '@/db/actions/sessions-actions';

// Define a generic fetcher function for useSWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Define the props type for the page component
interface SessionDetailPageProps {
  params: {
    'project-id': string;
    'session-id': string;
  };
}

export default function SessionDetailPage({ params }: SessionDetailPageProps) {
  // Access params directly, no need for await in Client Components
  const { 'project-id': projectId, 'session-id': sessionId } = params;

  console.log("Rendering Session Page:", { projectId, sessionId }); // Log params

  const [apiRoute, setApiRoute] = useState<string>('/api/opera/chat'); // State for API route
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const messages = await getSessionMessagesForChat(sessionId);
        if (messages) {
          setInitialMessages(messages);
        }
      } catch (error) {
        console.error('Error loading initial messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    loadMessages();
  }, [sessionId]);

  const { messages, data, input, handleInputChange, handleSubmit, stop, status } = useChat({
    maxSteps: 3, // Consider if maxSteps should differ per route
    api: apiRoute, // Use state variable for API route
    initialMessages: initialMessages,
    // Include projectId and sessionId in the body sent with each request
    body: {
        projectId: projectId,
        sessionId: sessionId
    }
    // TODO: Add logic here to load initialMessages based on sessionId if needed
    // initialMessages: fetchedMessagesForSession, 
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-7-sonnet-20250219');
  const [selectedTools, setSelectedTools] = useState<string[]>(['playwright', 'props']);
  const [availableModels, setAvailableModels] = useState<{ key: string, label: string }[]>([]);
  const [availableTools, setAvailableTools] = useState<{ key: string, label: string }[]>([]);
  const [sshStatus, setSshStatus] = useState<{ connected: boolean, cwd: string | null }>({ connected: false, cwd: null });
  const [isConnecting, setIsConnecting] = useState(false);
  const [browserStatus, setBrowserStatus] = useState<{ initialized: boolean, viewport: { width: number, height: number } | null, url: string | null }>({ initialized: false, viewport: null, url: null });
  const [isBrowserLoading, setIsBrowserLoading] = useState(false);
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
    credentials: any; 
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

  useEffect(() => {
    if (castingData) {
      setAvailableModels(castingData.models || []);
      setAvailableTools(castingData.tools || []);
      if (!selectedModel && castingData.models && castingData.models.length > 0) {
        const defaultModelKey = castingData.models.find((m) => m.key === 'grok-3-latest')
          ? 'grok-3-latest'
          : castingData.models[0].key;
        setSelectedModel(defaultModelKey);
      }
    }
    if (castingError) {
      console.error('Error fetching casting options via SWR:', castingError);
    }
  }, [castingData, castingError, selectedModel]);

  useEffect(() => {
    if (sshData) {
      const newStatus = {
        connected: sshData.status === 'Connected',
        cwd: sshData.cwd
      };
      if (newStatus.connected !== sshStatus.connected || newStatus.cwd !== sshStatus.cwd) {
        setSshStatus(newStatus);
      }
    } else if (sshError) {
      console.error('Error fetching SSH status via SWR:', sshError);
      if (sshStatus.connected) {
         setSshStatus({ connected: false, cwd: null });
      }
    }
  }, [sshData, sshError, sshStatus]);

    const fetchBrowserStatus = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/playwright', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getStatus' }) });
      let initialized = false;
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        initialized = statusData.status?.browserInitialized;
      }
      let viewport = null;
      let url = null;
      if (initialized) {
        const viewportRes = await fetch('/api/playwright', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getViewportSize' }) });
        if (viewportRes.ok) {
          const viewportData = await viewportRes.json();
          viewport = viewportData.viewport || null;
        }
      }
      setBrowserStatus({ initialized, viewport, url });
    } catch (error) {
      console.error('Error fetching browser status:', error);
      setBrowserStatus({ initialized: false, viewport: null, url: null });
    }
  }, []);

  useEffect(() => {
    fetchBrowserStatus();
    if (!browserStatus.initialized && !isBrowserLoading) {
      handleBrowserInit();
    }
    const intervalId = setInterval(fetchBrowserStatus, 5000);
    return () => clearInterval(intervalId);
  }, [fetchBrowserStatus, browserStatus.initialized, isBrowserLoading]); // Added handleBrowserInit to deps


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
      } else {
        console.log(`SSH ${action} successful`);
        // Manually update status after successful action or rely on SWR refetch
        // Consider calling your SWR mutate function here if using one
        // For now, we assume SWR will eventually catch up
      }
    } catch (error) {
      console.error(`Error during SSH ${action}:`, error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  const customHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userMessage: Message = { // Use Message from @ai-sdk/react or your defined type
      id: generateId(),
      role: 'user',
      content: input,
      parts: [
        {
          type: 'text',
          text: input
        }
      ],
      createdAt: new Date(),
    };

    handleSubmit(e, {
      // Pass projectId and sessionId in the main body object
      body: {
        messages: [userMessage], // Pass the constructed userMessage
        model: selectedModel,
        tools: selectedTools,
        projectId: projectId,
        sessionId: sessionId,
        customInfo: `The current active page is Context: ${activeContextId}, Page: ${activePageId || 'unknown'}.`
      }
    });
  };

   const handleBrowserInit = async () => {
     setIsBrowserLoading(true);
    try {
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

   const validatedData = React.useMemo(() => {
       if (apiRoute === '/api/opera/counterfeit' && Array.isArray(data) && data.length > 0) {
        const latestCounterfeitState = data[data.length - 1];
        const validationResult = CounterMessagesSchema.safeParse(latestCounterfeitState);

        if (validationResult.success) {
          return { type: 'success' as const, data: validationResult.data };
        } else {
          console.error("Opera Page: Invalid counterfeit data received:", validationResult.error.flatten());
          return { type: 'error' as const, message: "Failed to process or display the latest plan due to invalid data." };
        }
       }
       return null;
  }, [data, apiRoute]);

  // Render the Opera UI
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
          {/* Left sidebar */}
          <ResizablePanel defaultSize={30} minSize={30} maxSize={50}>
             <div className="h-full flex flex-col">
               {/* Header */}
               <header className="flex items-center px-3 py-2 shrink-0">
                <SidebarTrigger />
                {/* TODO: Display project/session info here? */}
                <p className="flex-1 text-lg font-serif text-center"> Opera </p>
                <Toggle
                  pressed={apiRoute === '/api/opera/counterfeit'}
                  onPressedChange={(checked) => setApiRoute(checked ? '/api/opera/counterfeit' : '/api/opera/chat')}
                  className="ml-auto cursor-pointer"
                >
                  <BrainCog color={apiRoute === '/api/opera/counterfeit' ? 'cyan' : 'white'} />
                </Toggle>
              </header>

               {/* Messages Section */}
               <div className="flex-1 overflow-auto w-full">
                 <ScrollArea className="h-full w-full px-3 pb-2">
                   <div className="space-y-2 h-full w-full">
                     {messages.map((m, index) => {
                       const isLastMessage = index === messages.length - 1;
                        if (isLastMessage && validatedData) {
                          if (validatedData.type === 'success') {
                            // Adjust index based on how finalMessages should be displayed
                            return validatedData.data.finalMessages.slice(1).map((finalMsg, finalIndex) => (
                              <MessageBubble
                                key={finalMsg.id || `final-${finalIndex}`}
                                m={finalMsg as any}
                                openStates={openStates}
                                expandedResults={expandedResults}
                                toggleOpen={toggleOpen}
                                toggleExpandResult={toggleExpandResult}
                                // Potentially adjust index for data assignment
                                data={finalIndex === validatedData.data.finalMessages.length - 2 ? { plan: validatedData.data.plan } : undefined} 
                                apiRoute={apiRoute}
                                // Potentially adjust index for last message check
                                isLastMessage={isLastMessage && finalIndex === validatedData.data.finalMessages.length - 2} 
                              />
                            ));
                          } else if (validatedData.type === 'error') {
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
                        return (
                          <MessageBubble
                            key={m.id}
                            m={m}
                            openStates={openStates}
                            expandedResults={expandedResults}
                            toggleOpen={toggleOpen}
                            toggleExpandResult={toggleExpandResult}
                            data={undefined}
                            apiRoute={apiRoute}
                            isLastMessage={isLastMessage}
                          />
                        );
                     })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

               {/* Input Section */}
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

          {/* Right stage area */}
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