import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Cat, Bot, Bug } from 'lucide-react';
import React, { useState } from 'react';
import { MemoizedMarkdown } from '@/components/message-display/memoized-markdown';
import { JSONValue, type Message } from 'ai'; // Import JSONValue and Message types
import { ToolInvocationCall } from '@/components/message-display/tool-invocation-call';
import { ToolInvocationResult } from '@/components/message-display/tool-invocation-result';
import { Button } from '@/components/ui/button';
import { useDebug } from '@/context/DebugContext'; // Import useDebug

// Helper function to count lines in a text string
const countLines = (text: string): number => {
  return text ? text.split('\n').length : 0;
};

interface MessageBubbleProps {
  m: Message; // Use the imported Message type
  openStates: Record<string, boolean>;
  expandedResults: Record<string, boolean>;
  toggleOpen: (key: string) => void;
  toggleExpandResult: (key: string) => void;
  data?: { plan: any[] } | JSONValue[] | undefined; // Updated type to accept plan object
  apiRoute?: string; // Added apiRoute prop
  isLastMessage?: boolean; // Added isLastMessage prop
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ m, openStates, expandedResults, toggleOpen, toggleExpandResult, data, apiRoute, isLastMessage }) => {
  const [showLocalDebug, setShowLocalDebug] = useState(false); // Renamed to avoid confusion
  const { isDebugMode: isGlobalDebugMode } = useDebug(); // Get global debug state

  // Show debug elements only if global debug mode is on
  const canShowDebugElements = isGlobalDebugMode; // Declare the missing constant

  // --- Default Rendering Logic (Handles text, tool calls, etc.) ---
  if (Array.isArray(m?.parts)) {
    return (
      <div className="flex items-start gap-2 w-auto justify-start rounded-lg">
        <Avatar className="border" onClick={() => canShowDebugElements && setShowLocalDebug(!showLocalDebug)} style={{ cursor: canShowDebugElements ? 'pointer' : 'default' }}>
          <AvatarImage src={m.role === 'user' ? '/avatars/user_avatar.jpeg' : '/avatars/bot_avatar.jpeg'} />
          <AvatarFallback>{m.role === 'user' ? <Cat /> : <Bot />}</AvatarFallback>
        </Avatar>
        <div className="space-y-1 break-words overflow-hidden w-auto max-w-full">
          {/* Debug button - only show if global debug mode is on */}
          {canShowDebugElements && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowLocalDebug(!showLocalDebug)}
              className="mb-1 h-6 px-2 text-xs flex items-center gap-1"
            >
              <Bug size={12} />
              {showLocalDebug ? 'Hide Debug' : 'Debug'}
            </Button>
          )}

          {/* Debug panel - only show if global debug AND local debug are on */}
          {canShowDebugElements && showLocalDebug && (
            <div className="mb-2 border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md text-xs overflow-auto">
              <h4 className="text-yellow-800 dark:text-yellow-300 font-medium mb-1">Debug Info:</h4>
              <div className="grid gap-2">
                <div>
                  <p className="font-semibold mb-1 text-yellow-700 dark:text-yellow-400">Message Object:</p>
                  <pre className="bg-black/5 dark:bg-white/5 p-2 rounded overflow-auto max-h-60 text-[10px]">
                    {JSON.stringify(m, null, 2)}
                  </pre>
                </div>
                {data && (
                  <div>
                    <p className="font-semibold mb-1 text-yellow-700 dark:text-yellow-400">Data Prop:</p>
                    <pre className="bg-black/5 dark:bg-white/5 p-2 rounded overflow-auto max-h-60 text-[10px]">
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </div>
                )}
                <div>
                  <p className="font-semibold mb-1 text-yellow-700 dark:text-yellow-400">API Route:</p>
                  <code className="bg-black/5 dark:bg-white/5 p-2 rounded">{apiRoute || 'not specified'}</code>
                </div>
              </div>
            </div>
          )}

          {m.parts.map((part: any, partIndex: number) => {
            const partKey = `${m.id}-${partIndex}`;
            if (part.type === 'text') {
              return (
                <div key={partKey} className={`rounded-lg px-3 py-2 w-full overflow-hidden break-words ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <MemoizedMarkdown content={part.text} id={partKey} />
                </div>
              );
            }
            if (part.type === 'tool-invocation') {
              const toolInvocation = part.toolInvocation;
              const toolStyle = "border rounded-lg px-3 py-2 bg-muted/50 text-muted-foreground text-sm italic";
              if (toolInvocation.state === 'call') {
                return (
                  <ToolInvocationCall
                    key={partKey}
                    toolName={toolInvocation.toolName}
                    args={toolInvocation.args}
                    className={toolStyle}
                  />
                );
              }
              if (toolInvocation.state === 'result') {
                return (
                  <ToolInvocationResult
                    key={partKey}
                    partKey={partKey}
                    toolInvocation={toolInvocation}
                    openStates={openStates}
                    expandedResults={expandedResults}
                    toggleOpen={toggleOpen}
                    toggleExpandResult={toggleExpandResult}
                    countLines={countLines}
                    className={toolStyle}
                  />
                );
              }
              // default for tool-invocation
              return <div key={partKey} className={`${toolStyle} text-xs italic break-words`}>Tool ({toolInvocation.toolName}) - State: {toolInvocation.state}</div>;
            }
            if (part.type === 'step-start') {
              // show step boundaries as horizontal lines:
              return partIndex > 0 ? (
                <div key={partKey} className="relative my-2 text-muted-foreground p-1 flex items-center justify-center">
                  <hr className="border-muted flex-1" />
                  <span className="px-2 text-xs font-medium">new step</span>
                  <hr className="border-muted flex-1" />
                </div>
              ) : null;
            }
            // fallback for unknown part type
            return <div key={partKey} className="break-words text-sm bg-muted/30 rounded-lg px-3 py-2">
              <p className="font-medium text-foreground">Unsupported part type</p>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground mt-1">{JSON.stringify(part, null, 2)}</pre>
            </div>;
          })}
        </div>
      </div>
    );
  }
  // fallback for non-array parts
  return (
    <div className="flex items-start gap-3 justify-start">
      <Avatar className="border" onClick={() => canShowDebugElements && setShowLocalDebug(!showLocalDebug)} style={{ cursor: canShowDebugElements ? 'pointer' : 'default' }}>
        <AvatarFallback>{m.role === 'user' ? <Cat /> : <Bot />}</AvatarFallback>
      </Avatar>
      <div className="space-y-1 max-w-3xl break-words overflow-hidden">
        {/* Debug button for fallback - only show if global debug mode is on */}
        {canShowDebugElements && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setShowLocalDebug(!showLocalDebug)}
            className="mb-1 h-6 px-2 text-xs flex items-center gap-1"
          >
            <Bug size={12} />
            {showLocalDebug ? 'Hide Debug' : 'Debug'}
          </Button>
        )}

        {/* Debug panel for fallback - only show if global debug AND local debug are on */}
        {canShowDebugElements && showLocalDebug && (
          <div className="mb-2 border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md text-xs overflow-auto">
            <h4 className="text-yellow-800 dark:text-yellow-300 font-medium mb-1">Debug Info:</h4>
            <div className="grid gap-2">
              <div>
                <p className="font-semibold mb-1 text-yellow-700 dark:text-yellow-400">Message Object:</p>
                <pre className="bg-black/5 dark:bg-white/5 p-2 rounded overflow-auto max-h-60 text-[10px]">
                  {JSON.stringify(m, null, 2)}
                </pre>
              </div>
              {data && (
                <div>
                  <p className="font-semibold mb-1 text-yellow-700 dark:text-yellow-400">Data Prop:</p>
                  <pre className="bg-black/5 dark:bg-white/5 p-2 rounded overflow-auto max-h-60 text-[10px]">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <p className="font-semibold mb-1 text-yellow-700 dark:text-yellow-400">API Route:</p>
                <code className="bg-black/5 dark:bg-white/5 p-2 rounded">{apiRoute || 'not specified'}</code>
              </div>
            </div>
          </div>
        )}

        {m.content && m.content.length > 0 ? (
          <p className="whitespace-pre-wrap text-sm">{m.content}</p>
        ) : (
          <p className="italic text-sm opacity-70">
            {m?.toolInvocations?.[0]?.toolName ? `Processing tool: ${m.toolInvocations[0].toolName}` : 'Processing...'}
          </p>
        )}
      </div>
    </div>
  );
};

export default MessageBubble; 