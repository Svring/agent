'use client';

import { Message, useChat } from '@ai-sdk/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cat, Bot, Cog, Eye, EyeOff, Hammer } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function Chat({
  id,
  initialMessages,
}: { id?: string | undefined; initialMessages?: Message[] } = {}) {
  const { input, handleInputChange, handleSubmit, messages, addToolResult } = useChat({
    api: '/api/automation',
    id,
    initialMessages,
    maxSteps: 5,
    sendExtraMessageFields: true,
    onToolCall({ toolCall }) {
      console.log('Client-side onToolCall triggered:', toolCall);
    },
    experimental_prepareRequestBody({ messages, id }) {
      return { message: messages[messages.length - 1], id };
    },
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});

  const toggleOpen = (key: string) => {
    setOpenStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col w-full h-full p-8 px-20">
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.map(m => (
            <div key={m.id} className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <Avatar className="border mt-1">
                  <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[80%] space-y-1`}>
                {m.parts.map((part, partIndex) => {
                  const partKey = `${m.id}-${partIndex}`;

                  switch (part.type) {
                    case 'text':
                      return (
                        <div key={partKey} className={`rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <p className="whitespace-pre-wrap text-sm">{part.text}</p>
                        </div>
                      );

                    case 'tool-invocation': {
                      const toolInvocation = part.toolInvocation;
                      const callId = toolInvocation.toolCallId;
                      const toolName = toolInvocation.toolName;
                      const actionName = (toolInvocation.args && typeof toolInvocation.args === 'object' && 'action' in toolInvocation.args)
                        ? String(toolInvocation.args.action)
                        : 'unknown';

                      const toolStyle = "border rounded-lg px-3 py-2 bg-muted/50 text-muted-foreground text-sm italic";

                      switch (toolInvocation.state) {
                        case 'call':
                          if (toolName === 'askForConfirmation') {
                            return (
                              <div key={partKey} className={`${toolStyle} not-italic text-foreground`}> 
                                <p className="mb-2">{toolInvocation.args.message as string}</p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      addToolResult({
                                        toolCallId: callId,
                                        result: 'Yes, confirmed.',
                                      })
                                    }
                                  >
                                    Yes
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      addToolResult({
                                        toolCallId: callId,
                                        result: 'No, denied',
                                      })
                                    }
                                  >
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
                                <span>
                                  Calling {toolName} ({actionName})...
                                </span>
                              </div>
                            </div>
                          );
                        case 'result': {
                          let resultDisplay: React.ReactNode;
                          let isImageResult = false;
                          const resultData = toolInvocation.result;

                          if (toolName === 'askForConfirmation') {
                              resultDisplay = <span className="whitespace-pre-wrap font-semibold">{resultData as string}</span>;
                              return (
                                <div key={partKey} className={`${toolStyle} not-italic text-foreground`}>
                                    {resultDisplay}
                                </div>
                               );
                          } else if (toolName === 'computer' &&
                            actionName === 'screenshot' &&
                            typeof resultData === 'object' &&
                            resultData !== null &&
                            'type' in resultData && resultData.type === 'image' &&
                            'format' in resultData && typeof resultData.format === 'string' &&
                            'data' in resultData && typeof resultData.data === 'string') {
                            isImageResult = true;
                            const dataUri = `data:image/${resultData.format};base64,${resultData.data}`;
                            resultDisplay = <img src={dataUri} alt={`Screenshot result`} className="max-w-full h-auto rounded border my-1" />;
                          } else if (typeof resultData === 'string') {
                            resultDisplay = <span className="whitespace-pre-wrap">{resultData}</span>;
                          } else {
                            resultDisplay = <span className="whitespace-pre-wrap">{JSON.stringify(resultData)}</span>;
                          }

                          const label = (
                            <p className="font-medium flex items-center text-foreground">
                              <Hammer className="h-4 w-4 mr-1 flex-shrink-0" />
                              Calling tool - {toolName}(action: {actionName}):
                            </p>
                          );

                          if (isImageResult) {
                            const isOpen = !!openStates[partKey];
                            return (
                              <div key={partKey} className={`${toolStyle} text-foreground space-y-1`}>
                                {label}
                                <Collapsible
                                  open={isOpen}
                                  onOpenChange={() => toggleOpen(partKey)}
                                  className="w-full"
                                >
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="flex items-center text-xs h-auto py-0.5 px-1.5">
                                      {isOpen ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                                      {isOpen ? 'Hide Screenshot' : 'Show Screenshot'}
                                    </Button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="pt-2">
                                    {resultDisplay}
                                  </CollapsibleContent>
                                </Collapsible>
                              </div>
                            );
                          } else {
                            return (
                              <div key={partKey} className={`${toolStyle} text-foreground space-y-1`}>
                                {label}
                                {resultDisplay}
                              </div>
                            );
                          }
                        }

                        default:
                          return (
                            <div key={partKey} className={`${toolStyle} text-xs italic`}>
                              Tool ({toolName}) - State: {toolInvocation.state}
                            </div>
                          );
                      }
                    }

                    default:
                      return <div key={partKey}>Unsupported part type</div>;

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

      <form onSubmit={handleSubmit} className="flex gap-2 justify-center pt-4">
        <input
          className="w-2/3 p-2 px-4 rounded-full border border-gray-300"
          value={input}
          placeholder="Type a message..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}