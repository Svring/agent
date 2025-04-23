import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Cat, Bot, Cog, Eye, EyeOff, Hammer } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import React from 'react';

// Helper function to count lines in a text string
const countLines = (text: string): number => {
  return text ? text.split('\n').length : 0;
};

interface MessageBubbleProps {
  m: any;
  openStates: Record<string, boolean>;
  expandedResults: Record<string, boolean>;
  toggleOpen: (key: string) => void;
  toggleExpandResult: (key: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ m, openStates, expandedResults, toggleOpen, toggleExpandResult }) => {
  if (Array.isArray(m.parts)) {
    return (
      <div className="flex items-start gap-2 justify-start">
        <Avatar className="border">
          <AvatarFallback>{m.role === 'user' ? <Cat /> : <Bot />}</AvatarFallback>
        </Avatar>
        <div className="space-y-1 max-w-3xl">
          {m.parts.map((part: any, partIndex: number) => {
            const partKey = `${m.id}-${partIndex}`;
            if (part.type === 'text') {
              return (
                <div key={partKey} className={`rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <p className="whitespace-pre-wrap text-wrap text-sm break-words">{part.text}</p>
                </div>
              );
            }
            if (part.type === 'tool-invocation') {
              const toolInvocation = part.toolInvocation;
              const callId = toolInvocation.toolCallId;
              const toolName = toolInvocation.toolName;
              const actionName = (toolInvocation.args && 'action' in toolInvocation.args)
                ? String(toolInvocation.args.action)
                : 'unknown';
              const toolStyle = "border rounded-lg px-3 py-2 bg-muted/50 text-muted-foreground text-sm italic";
              if (toolInvocation.state === 'call') {
                return (
                  <div key={partKey} className={toolStyle}>
                    <div className="flex items-center gap-2">
                      <Cog className="h-4 w-4 animate-spin" />
                      <span className="break-words">Calling {toolName} ({actionName})...</span>
                    </div>
                  </div>
                );
              }
              if (toolInvocation.state === 'result') {
                let resultDisplay: React.ReactNode;
                let isImageResult = false;
                const resultData = toolInvocation.result;
                if (resultData.type === 'image' && resultData.data.length > 0) {
                  isImageResult = true;
                  const mimeType = resultData.mimeType || 'image/png';
                  const dataUri = `data:${mimeType};base64,${resultData.data}`;
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
                const resultText = typeof resultData === 'string'
                  ? resultData
                  : JSON.stringify(resultData, null, 2);
                const lineCount = countLines(resultText);
                const isLongResult = lineCount > 5;
                const resultKey = `${partKey}-result`;
                const isExpanded = expandedResults[resultKey] || false;
                let previewResult = null;
                if (isLongResult && !isImageResult && typeof resultText === 'string') {
                  const previewLines = resultText.split('\n').slice(0, 5).join('\n');
                  previewResult = <span className="whitespace-pre-wrap break-words">{previewLines}...</span>;
                }
                return (
                  <div key={partKey} className={`${toolStyle} text-foreground space-y-1`}>
                    {label}
                    {isImageResult ? (
                      <Collapsible open={openStates[partKey] !== undefined ? openStates[partKey] : true} onOpenChange={() => toggleOpen(partKey)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="flex items-center text-xs h-auto py-0.5 px-1.5">
                            {openStates[partKey] ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                            {openStates[partKey] ? 'Hide Screenshot' : 'Show Screenshot'}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">{resultDisplay}</CollapsibleContent>
                      </Collapsible>
                    ) : isLongResult ? (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center text-xs h-auto py-0.5 mb-1"
                          onClick={() => toggleExpandResult(resultKey)}
                        >
                          {isExpanded ? (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Show Full Result ({lineCount} lines)
                            </>
                          )}
                        </Button>
                        {isExpanded ? (
                          <div>{resultDisplay}</div>
                        ) : (
                          <div>{previewResult}</div>
                        )}
                      </div>
                    ) : resultDisplay}
                  </div>
                );
              }
              // default for tool-invocation
              return <div key={partKey} className={`${toolStyle} text-xs italic break-words`}>Tool ({toolName}) - State: {toolInvocation.state}</div>;
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
      <Avatar className="border">
        <AvatarFallback>{m.role === 'user' ? <Cat /> : <Bot />}</AvatarFallback>
      </Avatar>
      <div className="space-y-1 max-w-3xl">
        {m.content && m.content.length > 0 ? (
          <p className="whitespace-pre-wrap text-sm">{m.content}</p>
        ) : (
          <p className="italic text-sm opacity-70">
            {'Calling tool: ' + m?.toolInvocations?.[0]?.toolName}
          </p>
        )}
      </div>
    </div>
  );
};

export default MessageBubble; 