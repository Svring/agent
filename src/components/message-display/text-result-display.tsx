import React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import ReactJson from 'react-json-view'

interface TextResultDisplayProps {
  partKey: string; // Included for potential future use or debugging context
  resultData: any; // Can be string, object, array, etc.
  isExpanded: boolean;
  toggleExpandResult: () => void;
  countLines: (text: string) => number;
}

const MAX_PREVIEW_LINES = 5;

export const TextResultDisplay: React.FC<TextResultDisplayProps> = ({
  resultData,
  isExpanded,
  toggleExpandResult,
  countLines
}) => {
  const isJsonObject = typeof resultData === 'object' && resultData !== null && !Array.isArray(resultData);
  const isJsonArray = Array.isArray(resultData);
  const isJsonData = isJsonObject || isJsonArray;

  if (isJsonData) {
    // Render JSON data using ReactJson
    return (
      <div className="text-xs font-mono bg-background p-2 rounded border overflow-x-auto">
         <ReactJson
            src={resultData}
            name={false}
            theme="shapeshifter"
            collapsed={true} // Default collapse level
            displayDataTypes={true}
            enableClipboard={false} // Optional: disable clipboard copy
            style={{ backgroundColor: 'transparent' }} // Match background
        />
      </div>
    );
  }

  // Handle non-JSON data (strings, null, undefined, etc.)
  let resultText: string = '';
  if (typeof resultData === 'string') {
    resultText = resultData;
  } else if (resultData === null || resultData === undefined) {
    resultText = '(empty result)';
  } else {
    // Fallback for other non-JSON types (e.g., numbers, booleans)
    try {
      resultText = String(resultData);
    } catch (error) {
      console.error("Error converting result data to string:", error);
      resultText = "[Error displaying result]";
    }
  }

  const lineCount = countLines(resultText);
  const isLongResult = lineCount > MAX_PREVIEW_LINES;

  // Display using pre-wrap for formatting, break-words for overflow
  const fullResultDisplay = <pre className="whitespace-pre-wrap break-words text-xs font-mono bg-background p-2 rounded border">{resultText}</pre>;

  // If not a long string, just show the full result directly
  if (!isLongResult) {
    return fullResultDisplay;
  }

  // Handle long *string* results with preview
  const previewLines = resultText.split('\n').slice(0, MAX_PREVIEW_LINES).join('\n');
  const previewResultDisplay = (
    <pre className="whitespace-pre-wrap break-words text-xs font-mono bg-background p-2 rounded border">
      {previewLines}
      <span className="text-muted-foreground">... (see more: {lineCount} lines total)</span>
    </pre>
  );

  return (
    <div className="space-y-1">
      {/* Only show expand/collapse button for long string results */}
      <Button
        variant="link" // Use link variant for less emphasis
        size="sm"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "flex items-center text-xs h-auto py-0.5 px-1 rounded"})} // Consistent styling, less padding
        onClick={toggleExpandResult}
      >
        {isExpanded ? (
          <>
            <EyeOff className="h-3 w-3 mr-1 flex-shrink-0" />
            Show Less
          </>
        ) : (
          <>
            <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
            Show Full Result ({lineCount} lines)
          </>
        )}
      </Button>
      {/* Render the appropriate display based on expansion state */}
      {isExpanded ? fullResultDisplay : previewResultDisplay}
    </div>
  );
}; 