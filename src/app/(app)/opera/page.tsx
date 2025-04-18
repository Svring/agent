'use client';

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect } from 'react';
import MessageBubble from '@/components/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';

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

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="w-full h-full"
    >
      {/* Left sidebar - resizable, defaulting to 30% */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
        <div className="h-full flex flex-col p-2">
          <div className="flex flex-row px-1 items-center w-full rounded-lg">
            <SidebarTrigger />
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
      
      {/* Right stage area - resizable */}
      <ResizablePanel defaultSize={70}>
        <div className="h-full px-2">
          <Stage className="h-full" />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}