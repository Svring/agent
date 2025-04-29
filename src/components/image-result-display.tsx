import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface ImageResultDisplayProps {
  partKey: string; // Included for potential future use or debugging context
  imageDataUri: string;
  isOpen: boolean;
  toggleOpen: () => void;
}

export const ImageResultDisplay: React.FC<ImageResultDisplayProps> = ({ imageDataUri, isOpen, toggleOpen }) => {
  return (
    <Collapsible open={isOpen} onOpenChange={toggleOpen}>
      <CollapsibleTrigger asChild>
        {/* Use consistent styling and sizing */}
        <Button variant="ghost" size="sm" className="flex items-center text-xs h-auto py-0.5 px-1.5 rounded">
          {isOpen ? <EyeOff className="h-3 w-3 mr-1 flex-shrink-0" /> : <Eye className="h-3 w-3 mr-1 flex-shrink-0" />}
          {isOpen ? 'Hide Screenshot' : 'Show Screenshot'}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1"> {/* Reduced padding slightly */}
        {/* Added explicit alt text */}
        <img
          src={imageDataUri}
          alt="Tool result screenshot"
          className="max-w-full h-auto rounded border block" /* Ensure block display */
        />
      </CollapsibleContent>
    </Collapsible>
  );
}; 