import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

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
  // Standardize handling of different resultData types
  let resultText: string;
  try {
    if (typeof resultData === 'string') {
      resultText = resultData;
    } else if (resultData === null || resultData === undefined) {
      resultText = '(empty result)'; // Handle null/undefined explicitly
    } else {
      // Attempt to pretty-print objects/arrays, fallback to default stringification
      resultText = JSON.stringify(resultData, null, 2);
    }
  } catch (error) {
    console.error("Error stringifying result data:", error);
    resultText = "[Error displaying result]";
  }

  const lineCount = countLines(resultText);
  const isLongResult = lineCount > MAX_PREVIEW_LINES;

  // Display using pre-wrap for formatting, break-words for overflow
  const fullResultDisplay = <pre className="whitespace-pre-wrap break-words text-xs font-mono bg-background p-2 rounded border">{resultText}</pre>;

  // If not long, just show the full result directly
  if (!isLongResult) {
    return fullResultDisplay;
  }

  // Handle long results with preview
  const previewLines = resultText.split('\n').slice(0, MAX_PREVIEW_LINES).join('\n');
  const previewResultDisplay = (
    <pre className="whitespace-pre-wrap break-words text-xs font-mono bg-background p-2 rounded border">
      {previewLines}
      <span className="text-muted-foreground">... (see more)</span>
    </pre>
  );

  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center text-xs h-auto py-0.5 px-1.5 rounded" // Consistent styling
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