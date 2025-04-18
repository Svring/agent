'use client';

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect } from 'react';
import MessageBubble from '@/components/message-bubble';
import Stage from '@/components/stage';

export default function Opera() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    maxSteps: 3,
    api: '/api/opera',
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const [stageUrl, setStageUrl] = useState<string>('');
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
    <div className="flex w-full h-full">
      {/* Left sidebar - 30% width */}
      <div className="w-[30%] p-4 border-r">
        <ScrollArea className="h-[calc(100vh-100px)]">
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
        <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
          <input
            className="w-full p-2 px-4 rounded-full border border-gray-300"
            value={input}
            placeholder="Type a message..."
            onChange={handleInputChange}
          />
        </form>
      </div>
      
      {/* Right stage area - 70% width */}
      <div className="w-[70%] p-4">
        <Stage className="h-full" />
      </div>
    </div>
  );
}