'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect, useCallback } from 'react';
import React from 'react';
import MessageBubble from '@/components/message-display/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { useParams } from 'next/navigation';
import { Eye, ClipboardCopy, BrainCog, User as UserIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import useSWR from 'swr';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import { PlaywrightContext } from '@/context/PlaywrightContext';
import { CounterMessagesSchema } from '@/models/chatSchemas';
import { type Message as VercelMessage } from '@ai-sdk/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { useSshManager } from '@/hooks/useSshManager';
import { useBrowserManager } from '@/hooks/useBrowserManager';
import { useGalateaManager } from '@/hooks/useGalateaManager';
import { useChatSettings } from '@/hooks/useChatSettings';
import { FooterControlBars } from '@/components/footer-controls/FooterControlBars';
import { ChatInputBar } from '@/components/footer-controls/ChatInputBar';
import { useChatMessages } from '@/hooks/useChatMessages';

export default function SessionDetailPage() {
  const params = useParams<{ 'project-id': string, 'session-id': string }>();
  const { 'project-id': projectId, 'session-id': sessionId } = params;

  const { currentUser, authLoading } = useCurrentUser();
  const { projectDetails, isLoadingProject } = useProjectDetails(projectId, currentUser?.id?.toString());

  const [activeContextId, setActiveContextId] = useState<string>('opera');
  const [activePageId, setActivePageId] = useState<string | null>('main');

  const {
    sshStatus, isConnectingSsh, isInitializingSSH, handleSshToggle
  } = useSshManager(currentUser, authLoading, projectDetails);

  const {
    browserStatus, isBrowserLoading, handleBrowserInit, handleBrowserCleanup
  } = useBrowserManager(currentUser, authLoading);

  const {
    galateaStatus, checkAndFixGalatea, refreshGalateaHealth,
  } = useGalateaManager(currentUser, projectDetails, sshStatus.connected);

  const {
    selectedModel, selectedTools, setSelectedTools, availableModels, availableTools, handleModelChange, isLoadingSettings
  } = useChatSettings();

  const [apiRoute, setApiRoute] = useState<string>('/api/opera/chat');
  const [showAllMessagesSheet, setShowAllMessagesSheet] = useState(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    stop,
    status,
    isLoadingMessages,
    data: chatHookData,
  } = useChatMessages({
    sessionId,
    projectId,
    apiRoute,
    currentUser,
    authLoading,
    selectedModel,
    selectedTools,
    activeContextId,
    activePageId,
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef(null);

  const setActivePage = useCallback((contextId: string, pageId: string | null) => {
    setActiveContextId(contextId);
    setActivePageId(pageId);
  }, []);

  const toggleOpen = (key: string) => setOpenStates(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleExpandResult = (key: string) => setExpandedResults(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (messagesEndRef.current) {
      (messagesEndRef.current as HTMLElement).scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleApiToggle = async (newRoute: string) => {
    if (apiRoute === newRoute) return;
    console.log(`API route changing from ${apiRoute} to ${newRoute}`);
    if (status !== 'ready') {
      stop();
    }
    setApiRoute(newRoute);
  };

  const validatedData = React.useMemo(() => {
    if (apiRoute === '/api/opera/counterfeit' && Array.isArray(chatHookData) && chatHookData.length > 0) {
      const latestCounterfeitState = chatHookData[chatHookData.length - 1];
      const validationResult = CounterMessagesSchema.safeParse(latestCounterfeitState);
      if (validationResult.success) {
        return { type: 'success' as const, data: validationResult.data };
      } else {
        console.error("SessionDetailPage: Invalid counterfeit data received:", validationResult.error.flatten());
        return { type: 'error' as const, message: "Failed to process or display the latest plan due to invalid data." };
      }
    }
    return null;
  }, [chatHookData, apiRoute]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`${type} copied to clipboard!`))
      .catch(err => {
        toast.error(`Failed to copy ${type}.`);
        console.error('Failed to copy to clipboard:', err);
      });
  };

  if (authLoading || isLoadingProject) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">{authLoading ? 'Authenticating...' : 'Loading project...'}</p></div>;
  }
  if (!currentUser) {
    return <div className="flex items-center justify-center h-screen"><UserIcon className="h-8 w-8 mr-2 text-red-500" /> <p>Authentication failed or no active session.</p></div>;
  }

  return (
    <TooltipProvider>
      <style jsx>{`
        .animate-glow {
          box-shadow: 0 0 2px #22c55e, 0 0 4px #22c55e;
        }
      `}</style>
      <PlaywrightContext.Provider value={{ contextId: activeContextId, pageId: activePageId, setActivePage }}>
        <ResizablePanelGroup direction="horizontal" className="w-full h-full rounded-lg">
          <ResizablePanel defaultSize={30} minSize={30} maxSize={50}>
            <div className="h-full flex flex-col">
              <header className="flex items-center px-3 py-2 shrink-0">
                <SidebarTrigger />
                <p className="flex-1 text-lg font-serif text-center"> Opera </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setShowAllMessagesSheet(true)} className="mr-1 h-7 w-7">
                      <Eye size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>View Raw Messages Data</p></TooltipContent>
                </Tooltip>
                <Toggle
                  pressed={apiRoute === '/api/opera/counterfeit'}
                  onPressedChange={(checked) => handleApiToggle(checked ? '/api/opera/counterfeit' : '/api/opera/chat')}
                  className="ml-auto cursor-pointer"
                >
                  <BrainCog color={apiRoute === '/api/opera/counterfeit' ? 'cyan' : 'white'} />
                </Toggle>
              </header>
              <div className="flex-1 overflow-auto w-full">
                <ScrollArea className="h-full w-full px-3 pb-2">
                  <div className="space-y-2 h-full w-full">
                    {isLoadingMessages ? (
                      <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground">Loading messages...</p>
                      </div>
                    ) : (
                      messages.map((m, index) => {
                        const isLastMessage = index === messages.length - 1;
                        let messageSpecificData: { plan: any[] } | undefined = undefined;
                        if (apiRoute === '/api/opera/counterfeit' &&
                          validatedData && validatedData.type === 'success' &&
                          isLastMessage && validatedData.data.finalMessages.length > 0 &&
                          m.id === validatedData.data.finalMessages[validatedData.data.finalMessages.length - 1]?.id) {
                          messageSpecificData = { plan: validatedData.data.plan };
                        }

                        return (
                          <MessageBubble
                            key={m.id || `msg-${index}`}
                            m={m as VercelMessage}
                            openStates={openStates}
                            expandedResults={expandedResults}
                            toggleOpen={toggleOpen}
                            toggleExpandResult={toggleExpandResult}
                            data={messageSpecificData}
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
              <footer className="p-2 border-t shrink-0">
                <div className="flex w-full flex-col rounded-lg border shadow-sm">
                  <ChatInputBar
                    input={input}
                    handleInputChange={handleInputChange}
                    handleSubmit={handleSubmit}
                    status={status}
                    stop={stop}
                    selectedModel={selectedModel}
                    handleModelChange={handleModelChange}
                    availableModels={availableModels}
                    selectedTools={selectedTools}
                    setSelectedTools={setSelectedTools}
                    availableTools={availableTools}
                    isLoadingSettings={isLoadingSettings}
                  />
                  <FooterControlBars
                    sshProps={{
                      sshStatus, isConnectingSsh, isInitializingSSH, handleSshToggle
                    }}
                    browserProps={{
                      browserStatus, isBrowserLoading, handleBrowserInit, handleBrowserCleanup
                    }}
                    galateaProps={{
                      galateaStatus, checkAndFixGalatea, refreshGalateaHealth
                    }}
                  />
                </div>
              </footer>
            </div>
          </ResizablePanel>
          <ResizableHandle className="w-0.5 bg-muted transition-colors duration-200" />
          <ResizablePanel defaultSize={70}>
            <div className="h-full p-2">
              <Stage className="h-full w-full" />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </PlaywrightContext.Provider>

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
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(messages, null, 2), 'Messages JSON')} className="h-7 px-2 text-xs flex items-center gap-1">
                    <ClipboardCopy size={12} /> Copy JSON
                  </Button>
                </div>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(messages, null, 2)}
                </pre>
              </div>

              {(apiRoute === '/api/opera/counterfeit' && chatHookData && Array.isArray(chatHookData) && chatHookData.length > 0) && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Latest `data` prop (Counterfeit Plan):</h3>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(chatHookData[chatHookData.length - 1], null, 2), 'Counterfeit Data JSON')} className="h-7 px-2 text-xs flex items-center gap-1">
                      <ClipboardCopy size={12} /> Copy JSON
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(chatHookData[chatHookData.length - 1], null, 2)}
                  </pre>
                </div>
              )}

              {(apiRoute !== '/api/opera/counterfeit' && chatHookData) && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">`data` prop (Non-Counterfeit):</h3>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(chatHookData, null, 2), 'Data JSON')} className="h-7 px-2 text-xs flex items-center gap-1">
                      <ClipboardCopy size={12} /> Copy JSON
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(chatHookData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
          <SheetFooter>
            <SheetClose asChild><Button type="submit">Close</Button></SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}