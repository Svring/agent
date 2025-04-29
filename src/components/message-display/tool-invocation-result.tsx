import React from 'react';
import { Hammer } from 'lucide-react';
import { ImageResultDisplay } from '@/components/message-display/image-result-display';
import { TextResultDisplay } from '@/components/message-display/text-result-display';

// Define a more specific type for ToolInvocation if possible
// This is a placeholder based on observed usage
interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: { action?: string;[key: string]: any };
  state: 'call' | 'result' | 'error' | string; // Allow other potential states
  result?: any; // Result can be complex, define further if structure is known
}

interface ToolInvocationResultProps {
  partKey: string; // Unique key for this part
  toolInvocation: ToolInvocation; // Use the defined type
  openStates: Record<string, boolean>;
  expandedResults: Record<string, boolean>;
  toggleOpen: (key: string) => void;
  toggleExpandResult: (key: string) => void;
  countLines: (text: string) => number;
  className?: string; // Base style from MessageBubble
}

export const ToolInvocationResult: React.FC<ToolInvocationResultProps> = ({
  partKey,
  toolInvocation,
  openStates,
  expandedResults,
  toggleOpen,
  toggleExpandResult,
  countLines,
  className
}) => {
  const { toolName, args, result: resultData } = toolInvocation;

  // Safely access action name
  const actionName = (args && typeof args === 'object' && 'action' in args && args.action)
    ? String(args.action)
    : 'default';

  let isImageResult = false;
  let imageDataUri: string | null = null;

  // Check if resultData exists and has the expected image structure
  if (resultData && typeof resultData === 'object' && resultData.type === 'image' && typeof resultData.data === 'string' && resultData.data.length > 0) {
    isImageResult = true;
    const mimeType = typeof resultData.mimeType === 'string' ? resultData.mimeType : 'image/png';
    imageDataUri = `data:${mimeType};base64,${resultData.data}`;
  }

  const label = (
    <p className="font-medium flex items-center text-foreground">
      <Hammer className="h-4 w-4 mr-1 flex-shrink-0" />
      {/* Ensure text can wrap and doesn't overflow */}
      <span className="break-words min-w-0">Tool Result - {toolName}{actionName !== 'default' ? ` (action: ${actionName})` : ''}:</span>
    </p>
  );

  return (
    <div className={`${className} text-foreground space-y-1`}> {/* Apply base style */}
      {label}
      {isImageResult && imageDataUri ? (
        <ImageResultDisplay
          partKey={partKey}
          imageDataUri={imageDataUri}
          isOpen={openStates[partKey] !== undefined ? openStates[partKey] : true} // Default to open
          toggleOpen={() => toggleOpen(partKey)}
        />
      ) : (
        <TextResultDisplay
          partKey={partKey}
          // Pass resultData directly, TextResultDisplay will handle stringification if needed
          resultData={resultData}
          isExpanded={expandedResults[`${partKey}-result`] || false}
          toggleExpandResult={() => toggleExpandResult(`${partKey}-result`)}
          countLines={countLines}
        />
      )}
    </div>
  );
}; 