'use client';

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect } from 'react';
import MessageBubble from '@/components/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Hammer, Send, Server, Power, PowerOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [selectedModel, setSelectedModel] = useState<string>(''); // Initialize as empty
  const [selectedTools, setSelectedTools] = useState<string[]>(['props']);
  const [availableModels, setAvailableModels] = useState<{ key: string, label: string }[]>([]);
  const [availableTools, setAvailableTools] = useState<{ key: string, label: string }[]>([]);
  const [sshStatus, setSshStatus] = useState<{ connected: boolean, cwd: string | null }>({ connected: false, cwd: null });
  const [isConnecting, setIsConnecting] = useState(false);

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

  useEffect(() => {
    fetchSshStatus();
    const intervalId = setInterval(fetchSshStatus, 5000); // Fetch every 5 seconds
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
        tools: selectedTools
      }
    });
  };

  return (
    <TooltipProvider>
      <ResizablePanelGroup
        direction="horizontal"
        className="w-full h-full rounded-lg"
      >
        {/* Left sidebar - resizable, defaulting to 30% */}
        <ResizablePanel defaultSize={30} minSize={27} maxSize={50}>
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
              <div className="flex items-center h-auto px-2 text-xs text-muted-foreground mb-2 rounded">
                <span
                  className={`w-2 h-2 rounded-full mr-2 shrink-0 ${sshStatus.connected ? 'bg-green-500' : 'bg-gray-400'}`}
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
                        ? <PowerOff className="h-2 w-2" />
                        : <Power className="h-2 w-2" />
                      }
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {sshStatus.connected ? 'Disconnect SSH' : 'Connect SSH'}
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
    </TooltipProvider>
  );
}