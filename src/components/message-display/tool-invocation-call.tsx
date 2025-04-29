import React from 'react';
import { Cog } from 'lucide-react';

interface ToolInvocationCallProps {
  toolName: string;
  args: any; // Use specific type if known
  className?: string;
}

export const ToolInvocationCall: React.FC<ToolInvocationCallProps> = ({ toolName, args, className }) => {
  // Safely access 'action' property, provide default
  const actionName = (args && typeof args === 'object' && 'action' in args && args.action)
    ? String(args.action)
    : 'default'; // Provide a more descriptive default if possible

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Cog className="h-4 w-4 animate-spin flex-shrink-0" /> {/* Added flex-shrink-0 */}
        {/* Ensure text can wrap and doesn't overflow */}
        <span className="break-words min-w-0">Calling {toolName}{actionName !== 'default' ? ` (action: ${actionName})` : ''}...</span>
      </div>
    </div>
  );
}; 