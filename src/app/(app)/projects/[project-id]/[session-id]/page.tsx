'use client';

import { useChat, type Message } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect, useCallback } from 'react';
import React from 'react';
import MessageBubble from '@/components/message-display/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Hammer, Send, BrainCog, Power, PowerOff, Square, Bot, Eye, ClipboardCopy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetFooter, SheetDescription } from "@/components/ui/sheet";

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
import { Project } from '@/payload-types';
import { getProjectById } from '@/db/actions/projects-actions';

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

  const [apiRoute, setApiRoute] = useState<string>('/api/opera/chat');
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);
  const [isInitializingSSH, setIsInitializingSSH] = useState(false);
  const [showAllMessagesSheet, setShowAllMessagesSheet] = useState(false);

  // Fetch project details on mount
  useEffect(() => {
    if (projectId) {
      getProjectById(projectId)
        .then(data => {
          if (data) {
            setProjectDetails(data);
          } else {
            console.error("Project details not found for ID:", projectId);
            toast.error("Could not load project details for SSH configuration.");
          }
        })
        .catch(err => {
          console.error("Error fetching project details:", err);
          toast.error("Error fetching project details.");
        });
    }
  }, [projectId]);

  // Initial loading of messages - only when component first mounts or sessionId changes
  // The actual reloadMessagesFromDb function is defined after setMessages is available

  const { messages, data, input, handleInputChange, handleSubmit, stop, status, setMessages, reload } = useChat({
    maxSteps: 3,
    api: apiRoute,
    initialMessages: initialMessages, // initialMessages is still used for the very first load
    body: {
        projectId: projectId,
        sessionId: sessionId
    },
    onFinish: async () => { // Make onFinish async
      if (apiRoute === '/api/opera/counterfeit') {
        if (Array.isArray(data) && data.length > 0) {
          const latestCounterfeitState = data[data.length - 1];
          const validationResult = CounterMessagesSchema.safeParse(latestCounterfeitState);
          if (validationResult.success) {
            console.log("[onFinish] Counterfeit API call finished. Setting messages to finalMessages from stream first.");
            setMessages(validationResult.data.finalMessages as Message[]); // Update UI immediately
            
            console.log("[onFinish] Now, reloading messages from DB after counterfeit call.");
            await reloadMessagesFromDb(); // Then reload from DB
          } else {
            console.error("[onFinish] Counterfeit API call finished, but failed to parse finalMessages from the latest data chunk:", validationResult.error.flatten());
            await reloadMessagesFromDb();
          }
        } else {
          console.error("[onFinish] Counterfeit API call finished, but the 'data' array (from useChat) is empty or not an array. Reloading from DB as a fallback.");
          await reloadMessagesFromDb(); 
        }
      }
    }
  });

  // Function to load/reload messages from the DB
  // Defined here after setMessages and setIsLoadingMessages are available
  const reloadMessagesFromDb = useCallback(async () => {
    if (!sessionId) return;
    console.log(`Reloading messages from DB for session ${sessionId}`);
    setIsLoadingMessages(true);
    try {
      const messagesFromDb = await getSessionMessagesForChat(sessionId);
      if (messagesFromDb && messagesFromDb.length > 0) {
        setMessages(messagesFromDb as Message[]);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error reloading messages from DB:', error);
      toast.error("Failed to reload messages from database.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [sessionId, setMessages, setIsLoadingMessages]);

  useEffect(() => {
    // Initial load calls reloadMessagesFromDb
    if (sessionId) { // Ensure sessionId is available before calling
        reloadMessagesFromDb();
    }
  }, [sessionId, reloadMessagesFromDb]);

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

  const { data: sshData, error: sshError, mutate: mutateSshStatus } = useSWR<{
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
        console.log("SWR updating SSH status:", newStatus);
        setSshStatus(newStatus);
      }
    } else if (sshError) {
      console.error('Error fetching SSH status via SWR:', sshError);
      if (sshStatus.connected) {
         console.log("SWR error, setting SSH status to disconnected.");
         setSshStatus({ connected: false, cwd: null });
      }
    }
  }, [sshData, sshError]);

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

  // --- Initial SSH Connection Attempt --- 
  useEffect(() => {
    if (!sshStatus.connected && !isInitializingSSH && projectDetails) {
       console.log("Attempting initial SSH connection with project details...");
       handleSshToggle(true);
    }
  }, [projectDetails, sshStatus.connected]);

  const handleSshToggle = async (useProjectCredentials = false) => {
    if (isConnecting || isInitializingSSH) return; 

    const targetStateConnected = !sshStatus.connected; 
    const action = targetStateConnected ? 'initialize' : 'disconnect';
    
    console.log(`handleSshToggle called: action=${action}, useProjectCredentials=${useProjectCredentials}`);
    
    if (action === 'initialize') {
      setIsInitializingSSH(true);
    } else {
      setIsConnecting(true); 
    }

    try {
      let requestBody: { action: string; host?: string; port?: number; username?: string; password?: string } = { action };

      if (action === 'initialize') {
        if (useProjectCredentials && projectDetails?.dev_address && projectDetails.dev_address.length > 0) {
          const devEnv = projectDetails.dev_address[0];
          if (devEnv && devEnv.address && devEnv.username) {
            console.log("Using project dev credentials for SSH init:", devEnv);
            requestBody = {
              ...requestBody,
              host: devEnv.address,
              port: devEnv.port ?? undefined,
              username: devEnv.username,
              password: devEnv.password ?? undefined,
            };
          } else {
             console.warn("First dev environment details incomplete, falling back to default init.");
          }
        } else {
           console.log("Initializing SSH with default .env credentials.");
        }
      }

      const response = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      await mutateSshStatus(); 

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to ${action} SSH:`, errorData.message);
        toast.error(`SSH ${action} failed: ${errorData.message || 'Unknown error'}`);
      } else {
        const data = await response.json();
        console.log(`SSH ${action} request successful: ${data.message}`);
        toast.success(`SSH ${action} successful`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error during SSH ${action}:`, error);
      toast.error(`Error during SSH ${action}: ${errorMsg}`);
       await mutateSshStatus(); 
    } finally {
       setIsInitializingSSH(false); 
       setIsConnecting(false);
    }
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  // Modified API toggle handler to explicitly load and set messages
  const handleApiToggle = async (newRoute: string) => {
    if (apiRoute === newRoute) return; // No change if clicking the same route

    console.log(`API route changing from ${apiRoute} to ${newRoute}`);
    
    // Stop any ongoing generation
    if (status !== 'ready') {
      stop();
    }
    
    // Clear current messages in UI immediately for visual feedback
    setMessages([]);
    setIsLoadingMessages(true);
    
    // First update the route
    setApiRoute(newRoute);
    
    try {
      // Directly load messages for this session from DB
      console.log(`Loading messages for session ${sessionId} after API route change to ${newRoute}`);
      const messagesFromDb = await getSessionMessagesForChat(sessionId);
      
      // Use setMessages to update the messages displayed by useChat
      if (messagesFromDb && messagesFromDb.length > 0) {
        console.log(`Found ${messagesFromDb.length} messages for session ${sessionId}`);
        setMessages(messagesFromDb as Message[]);
      } else {
        console.log(`No messages found for session ${sessionId}`);
        setMessages([]);
      }
    } catch (error) {
      console.error(`Error loading messages after API change:`, error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const customHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userMessage: Message = {
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
      body: {
        messages: [userMessage],
        model: selectedModel,
        tools: selectedTools,
        projectId: projectId,
        sessionId: sessionId,
        customInfo: `The current active page is Context: ${activeContextId}, Page: ${activePageId || 'unknown'}. Current API: ${apiRoute}`
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
      toast.success("Browser initialized.");
    } catch (error) {
        toast.error("Failed to initialize browser.");
        console.error(error);
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
      toast.info("Browser cleaned up.");
    } catch(error) {
        toast.error("Failed to cleanup browser.");
        console.error(error);
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

  // Helper function for copying to clipboard
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success(`${type} copied to clipboard!`);
      })
      .catch(err => {
        toast.error(`Failed to copy ${type}.`);
        console.error('Failed to copy to clipboard:', err);
      });
  };

  // Determine which set of messages to render
  const messagesToRender = React.useMemo(() => {
    if (apiRoute === '/api/opera/counterfeit' && validatedData && validatedData.type === 'success') {
      // For counterfeit, finalMessages are in the last data chunk. 
      // We need to ensure user-initiated messages are also present, so we'll merge.
      // The first message in validatedData.data.finalMessages is often the initial user message.
      console.log("[Counterfeit Render] Using validatedData.data.finalMessages");
      return validatedData.data.finalMessages as Message[];
    } else {
      // For chat route, or if counterfeit data is not yet ready/valid, use messages from useChat directly.
      console.log("[Chat Render/Fallback] Using messages from useChat hook");
      return messages;
    }
  }, [apiRoute, validatedData, messages]);

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
                <p className="flex-1 text-lg font-serif text-center"> Opera </p>
                
                {/* Button to show all messages data */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setShowAllMessagesSheet(true)}
                      className="mr-1 h-7 w-7"
                    >
                      <Eye size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Raw Messages Data</p>
                  </TooltipContent>
                </Tooltip>

                <Toggle
                  pressed={apiRoute === '/api/opera/counterfeit'}
                  onPressedChange={(checked) => handleApiToggle(checked ? '/api/opera/counterfeit' : '/api/opera/chat')}
                  className="ml-auto cursor-pointer"
                >
                  <BrainCog color={apiRoute === '/api/opera/counterfeit' ? 'cyan' : 'white'} />
                </Toggle>
              </header>

               {/* Messages Section */}
               <div className="flex-1 overflow-auto w-full">
                 <ScrollArea className="h-full w-full px-3 pb-2">
                   <div className="space-y-2 h-full w-full">
                     {isLoadingMessages ? (
                          <div className="flex justify-center items-center h-full">
                              <p className="text-muted-foreground">Loading messages...</p>
                          </div>
                      ) : (
                        messagesToRender.map((m, index) => {
                          const isLastMessage = index === messagesToRender.length - 1;
                          // The complex logic for extracting from validatedData for the *last* message bubble
                          // is removed. We now pass the message `m` from `messagesToRender` directly.
                          // If data prop is needed for the last message bubble specifically for plan display,
                          // we can still pass it if `m` is the last message from `validatedData.data.finalMessages`
                          let messageSpecificData: { plan: any[] } | undefined = undefined;
                          if (apiRoute === '/api/opera/counterfeit' && 
                              validatedData && 
                              validatedData.type === 'success' && 
                              isLastMessage && 
                              m.id === validatedData.data.finalMessages[validatedData.data.finalMessages.length -1]?.id ) {
                                messageSpecificData = { plan: validatedData.data.plan };
                          }

                          return (
                             <MessageBubble
                               key={m.id || `msg-${index}`}
                               m={m}
                               openStates={openStates}
                               expandedResults={expandedResults}
                               toggleOpen={toggleOpen}
                               toggleExpandResult={toggleExpandResult}
                               data={messageSpecificData} // Pass plan data if applicable
                               apiRoute={apiRoute}
                               isLastMessage={isLastMessage} 
                             />
                           );
                        })
                      )}
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
                          <TooltipTrigger asChild>
                            {status !== 'ready' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={stop}
                                aria-label="Stop generating"
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
                                aria-label="Send message"
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
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 ml-2"
                          onClick={() => handleSshToggle()}
                          disabled={isConnecting || isInitializingSSH}
                        >
                          {sshStatus.connected
                            ? <PowerOff />
                            : <Power />
                          }
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isInitializingSSH ? 'Initializing...' : isConnecting ? 'Disconnecting...' : sshStatus.connected ? 'Disconnect SSH' : 'Connect SSH'}
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
                       <TooltipTrigger asChild>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-6 w-6 p-0 ml-2"
                           onClick={browserStatus.initialized ? handleBrowserCleanup : handleBrowserInit}
                           disabled={isBrowserLoading}
                         >
                           {browserStatus.initialized
                             ? <PowerOff className="h-4 w-4" /> 
                             : <Power className="h-4 w-4" />
                           }
                         </Button>
                       </TooltipTrigger>
                       <TooltipContent>
                         {isBrowserLoading ? (browserStatus.initialized ? 'Cleaning up...': 'Initializing...') : (browserStatus.initialized ? 'Cleanup Browser' : 'Initialize Browser')}
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

      {/* Sheet for All Messages Debug Data */}
      <Sheet open={showAllMessagesSheet} onOpenChange={setShowAllMessagesSheet}>
        <SheetContent className="w-full p-4 sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col overflow-auto" side="right">
          <SheetHeader>
            <SheetTitle>All Messages Raw Data</SheetTitle>
            <SheetDescription>
              Below is the raw JSON data for all messages currently in the chat, and the latest `data` prop from `useChat` (if any).
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Messages Array ({messages.length} items):</h3>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(messages, null, 2), 'Messages JSON')}
                    className="h-7 px-2 text-xs flex items-center gap-1"
                  >
                    <ClipboardCopy size={12} /> Copy JSON
                  </Button>
                </div>
                <pre 
                  className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                >
                  {JSON.stringify(messages, null, 2)}
                </pre>
              </div>

              {(apiRoute === '/api/opera/counterfeit' && data && Array.isArray(data) && data.length > 0) && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Latest `data` prop (Counterfeit Plan):</h3>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(data[data.length - 1], null, 2), 'Counterfeit Data JSON')}
                      className="h-7 px-2 text-xs flex items-center gap-1"
                    >
                      <ClipboardCopy size={12} /> Copy JSON
                    </Button>
                  </div>
                  <pre 
                    className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
                    {JSON.stringify(data[data.length - 1], null, 2)}
                  </pre>
                </div>
              )}

              {(apiRoute !== '/api/opera/counterfeit' && data) && (
                 <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">`data` prop (Non-Counterfeit):</h3>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(data, null, 2), 'Data JSON')}
                      className="h-7 px-2 text-xs flex items-center gap-1"
                    >
                      <ClipboardCopy size={12} /> Copy JSON
                    </Button>
                  </div>
                  <pre 
                    className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="submit">Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}