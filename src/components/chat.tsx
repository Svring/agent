'use client';

import { Message, useChat } from '@ai-sdk/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cat, Bot, Cog, Eye, EyeOff, Hammer, Mic, ArrowUp, Paperclip, ArrowLeft } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useParams, useRouter } from 'next/navigation';

export default function Chat({
  id,
  initialMessages,
}: { id?: string | undefined; initialMessages?: Message[] } = {}) {
  const router = useRouter();
  const params = useParams();
  const { input, handleInputChange, handleSubmit, messages, addToolResult, stop } = useChat({
    api: '/api/automation',
    id,
    initialMessages,
    maxSteps: 5,
    sendExtraMessageFields: true,
    onToolCall({ toolCall }) {
      console.log('Client-side onToolCall triggered:', toolCall);
    },
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleOpen = (key: string) => {
    setOpenStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Title Bar - Fixed height, always at top */}
      <header className="flex items-center px-8 shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold mx-auto">Chat</h2>
      </header>

      {/* Messages Section - Takes remaining space, scrollable */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-8 pb-4">
          <div className="space-y-4">
            {messages.map(m => (
              <div key={m.id} className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role !== 'user' && (
                  <Avatar className="border mt-1">
                    <AvatarFallback><Bot /></AvatarFallback>
                  </Avatar>
                )}
                <div className="space-y-1 max-w-3xl">
                  {m.parts.map((part, partIndex) => {
                    const partKey = `${m.id}-${partIndex}`;
                    switch (part.type) {
                      case 'text':
                        return (
                          <div key={partKey} className={`rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <p className="whitespace-pre-wrap text-wrap text-sm break-words">{part.text}</p>
                          </div>
                        );

                      case 'tool-invocation': {
                        const toolInvocation = part.toolInvocation;
                        const callId = toolInvocation.toolCallId;
                        const toolName = toolInvocation.toolName;
                        const actionName = (toolInvocation.args && 'action' in toolInvocation.args)
                          ? String(toolInvocation.args.action)
                          : 'unknown';
                        const toolStyle = "border rounded-lg px-3 py-2 bg-muted/50 text-muted-foreground text-sm italic";

                        switch (toolInvocation.state) {
                          case 'call':
                            if (toolName === 'askForConfirmation') {
                              return (
                                <div key={partKey} className={`${toolStyle} not-italic text-foreground`}>
                                  <p className="mb-2 break-words">{toolInvocation.args.message}</p>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => addToolResult({ toolCallId: callId, result: 'Yes, confirmed.' })}>
                                      Yes
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => addToolResult({ toolCallId: callId, result: 'No, denied' })}>
                                      No
                                    </Button>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={partKey} className={toolStyle}>
                                <div className="flex items-center gap-2">
                                  <Cog className="h-4 w-4 animate-spin" />
                                  <span className="break-words">Calling {toolName} ({actionName})...</span>
                                </div>
                              </div>
                            );
                          case 'result': {
                            let resultDisplay: React.ReactNode;
                            let isImageResult = false;
                            const resultData = toolInvocation.result;

                            if (toolName === 'askForConfirmation') {
                              resultDisplay = <span className="whitespace-pre-wrap font-semibold break-words">{resultData}</span>;
                              return <div key={partKey} className={`${toolStyle} not-italic text-foreground`}>{resultDisplay}</div>;
                            } else if (toolName === 'computer' && actionName === 'screenshot' && resultData?.type === 'image' && resultData?.data) {
                              isImageResult = true;
                              const dataUri = `data:image/${resultData.format};base64,${resultData.data}`;
                              resultDisplay = <img src={dataUri} alt="Screenshot" className="max-w-full h-auto rounded border my-1" />;
                            } else {
                              resultDisplay = <span className="whitespace-pre-wrap break-words">{typeof resultData === 'string' ? resultData : JSON.stringify(resultData)}</span>;
                            }

                            const label = (
                              <p className="font-medium flex items-center text-foreground">
                                <Hammer className="h-4 w-4 mr-1 flex-shrink-0" />
                                <span className="break-words">Calling tool - {toolName}(action: {actionName}):</span>
                              </p>
                            );

                            return (
                              <div key={partKey} className={`${toolStyle} text-foreground space-y-1`}>
                                {label}
                                {isImageResult ? (
                                  <Collapsible open={openStates[partKey]} onOpenChange={() => toggleOpen(partKey)}>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm" className="flex items-center text-xs h-auto py-0.5 px-1.5">
                                        {openStates[partKey] ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                                        {openStates[partKey] ? 'Hide Screenshot' : 'Show Screenshot'}
                                      </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-2">{resultDisplay}</CollapsibleContent>
                                  </Collapsible>
                                ) : resultDisplay}
                              </div>
                            );
                          }
                          default:
                            return <div key={partKey} className={`${toolStyle} text-xs italic break-words`}>Tool ({toolName}) - State: {toolInvocation.state}</div>;
                        }
                      }
                      default:
                        return <div key={partKey} className="break-words">Unsupported part type</div>;
                    }
                  })}
                </div>
                {m.role === 'user' && (
                  <Avatar className="border mt-1">
                    <AvatarFallback><Cat /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Input Section - Fixed height, always at bottom */}
      <footer className="px-8 py-4 border-t shrink-0">
        <div className="flex w-full flex-col rounded-3xl border bg-secondary shadow-sm">
          <form onSubmit={handleSubmit} className="flex w-full items-center p-2 pr-3">
            <Textarea
              className="flex-1 resize-none border-0 px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-2xl"
              placeholder="Ask anything..."
              value={input}
              onChange={handleInputChange}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e, { body: { appId: params.appId } });
                }
              }}
            />
          </form>
          <div className="flex items-center gap-1 p-2">
            <Button variant="ghost" size="icon" className="flex-shrink-0 relative">
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(e.target.files || undefined)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                ref={fileInputRef}
              />
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="ml-auto flex-shrink-0 rounded-full"
              onClick={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  handleSubmit(e, { body: { appId: params.appId } });
                } else {
                  stop();
                }
              }}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}