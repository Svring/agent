import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button, buttonVariants } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface ImageResultDisplayProps {
  partKey: string; // Included for potential future use or debugging context
  imageDataUri: string;
  isOpen: boolean;
  toggleOpen: () => void;
}

export const ImageResultDisplay: React.FC<ImageResultDisplayProps> = ({ imageDataUri, isOpen, toggleOpen }) => {
  return (
    <div className="text-xs font-mono bg-muted/30 p-2 rounded border border-dashed border-muted-foreground/50 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={toggleOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center text-xs font-semibold text-muted-foreground mb-1 cursor-pointer">
            {isOpen ? <EyeOff className="h-3 w-3 mr-1 flex-shrink-0" /> : <Eye className="h-3 w-3 mr-1 flex-shrink-0" />}
            <span>Screenshot ({isOpen ? 'click to hide' : 'click to show'})</span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <img
            src={imageDataUri}
            alt="Tool result screenshot"
            className="max-w-full h-auto rounded border block"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}; 