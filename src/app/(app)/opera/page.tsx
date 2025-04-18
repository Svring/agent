'use client';

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect } from 'react';
import MessageBubble from '@/components/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export default function Opera() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    maxSteps: 3,
    api: '/api/opera',
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const [browserStatus, setBrowserStatus] = useState<'initializing' | 'running' | 'error' | 'not-started'>('not-started');
  const messagesEndRef = useRef(null);

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

  // Initialize Playwright via API when component mounts
  useEffect(() => {
    const initBrowser = async () => {
      setBrowserStatus('initializing');
      try {
        // Explicitly send action: 'init'
        const response = await fetch('/api/playwright', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'init' })
        });
        const data = await response.json();

        if (response.ok && data.success) {
          setBrowserStatus('running');
          console.log('Browser initialization requested successfully via API.');
        } else {
          throw new Error(data.message || 'Failed to initialize browser via API');
        }
      } catch (error) {
        console.error('Error calling browser init API:', error);
        setBrowserStatus('error');
      }
    };

    initBrowser();

    // Cleanup: Send action: 'cleanup' when component unmounts
    return () => {
      console.log('Opera component unmounting - requesting context cleanup via API.');
      const cleanup = async () => {
        try {
          const response = await fetch('/api/playwright', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'cleanup' })
          });
          const data = await response.json();
          if (response.ok && data.success) {
            console.log('Context cleanup requested successfully via API.');
          } else {
            console.warn('API call for context cleanup failed or reported no action:', data.message);
          }
        } catch (e) {
          console.error("Error during context cleanup API call", e);
        }
      };
      cleanup();
    };
  }, []); // Empty dependency array ensures this runs once on mount

  const handleBrowserStatusClick = async () => {
    // Re-initialize if in error or not started state
    if (browserStatus === 'error' || browserStatus === 'not-started') {
      setBrowserStatus('initializing');
      try {
        // Explicitly send action: 'init'
        const response = await fetch('/api/playwright', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'init' })
        });
        const data = await response.json();

        if (response.ok && data.success) {
          setBrowserStatus('running');
          console.log('Browser re-initialization requested successfully via API.');
        } else {
          throw new Error(data.message || 'Failed to re-initialize browser via API');
        }
      } catch (error) {
        console.error('Error calling browser init API on click:', error);
        setBrowserStatus('error');
      }
    }
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="w-full h-full"
    >
      {/* Left sidebar - resizable, defaulting to 30% */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
        <div className="h-full flex flex-col p-2">
          <div className="flex flex-row px-1 items-center w-full rounded-lg justify-between">
            <SidebarTrigger />
            <Button
              size="sm"
              variant={browserStatus === 'running' ? "outline" : "destructive"}
              onClick={handleBrowserStatusClick}
              disabled={browserStatus === 'initializing'} // Disable button while initializing
            >
              Browser: {browserStatus === 'running' ? 'Active' :
                browserStatus === 'initializing' ? 'Starting...' :
                  browserStatus === 'error' ? 'Error' :
                    'Inactive'}
            </Button>
          </div>
          <ScrollArea className="flex-1 h-[calc(100vh-120px)]">
            <div className="space-y-4 pr-2">
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
          <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
            <input
              className="w-full p-2 rounded-full border border-gray-300"
              value={input}
              placeholder="Type a message..."
              onChange={handleInputChange}
            />
          </form>
        </div>
      </ResizablePanel>

      <ResizableHandle className="w-0.5 bg-muted transition-colors duration-200" />

      {/* Right stage area - Render Stage component conditionally */}
      <ResizablePanel defaultSize={70}>
        <div className="h-full p-2">
           {browserStatus === 'running' ? (
             <Stage className="h-full w-full" />
           ) : browserStatus === 'initializing' ? (
             <div className="h-full w-full flex items-center justify-center bg-muted rounded-lg">
                <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
                <p className="ml-3 text-muted-foreground">Initializing Browser...</p>
             </div>
           ) : (
             <div className="h-full w-full flex flex-col items-center justify-center bg-muted rounded-lg p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                <p className="font-semibold">Browser Not Active</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {browserStatus === 'error' 
                    ? 'An error occurred. Try initializing again.' 
                    : 'Browser is not initialized.'}
                </p>
                <Button onClick={handleBrowserStatusClick}>
                    Initialize Browser
                </Button>
             </div>
           )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}