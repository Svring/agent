'use client';

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect } from 'react';
import MessageBubble from '@/components/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Hammer, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/multi-select';

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
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4.1-nano');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<{key: string, label: string}[]>([]);
  const [availableTools, setAvailableTools] = useState<{key: string, label: string}[]>([]);

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
    const fetchCastingOptions = async () => {
      try {
        const response = await fetch('/api/casting');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models);
          setAvailableTools(data.tools);
          // Set default model to 'claude-3-5-sonnet-latest' if available, otherwise the first one
          if (data.models.length > 0 && !selectedModel) {
            const defaultModelKey = data.models.find((m: {key: string, label: string}) => m.key === 'claude-3-5-sonnet-latest')
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
  }, []); // Dependency array is empty to run only once on mount

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  const customHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e, { 
      body: { 
        model: selectedModel, 
        tools: selectedTools 
      } 
    });
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="w-full h-full rounded-lg"
    >
      {/* Left sidebar - resizable, defaulting to 30% */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
        <div className="h-full flex flex-col">
          {/* Title Bar - Fixed height, always at top */}
          <header className="flex items-center px-3 py-2 shrink-0">
            <SidebarTrigger />
            <p className="flex-1 text-lg font-serif text-center"> Opera </p>
          </header>

          {/* Messages Section - Takes remaining space, scrollable */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-3 pb-2">
              <div className="space-y-2">
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
                <div className="flex items-center justify-between mb-2">
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
            </div>
          </footer>
        </div>
      </ResizablePanel>

      <ResizableHandle className="w-0.5 bg-muted transition-colors duration-200" />

      {/* Right stage area - Render Stage component conditionally */}
      <ResizablePanel defaultSize={70}>
        <div className="h-full p-2">
           <Stage className="h-full w-full" autoInitializeBrowser={false} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}