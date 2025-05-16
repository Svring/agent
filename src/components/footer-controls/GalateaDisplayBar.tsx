import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PowerOff, RefreshCw, Loader2 } from 'lucide-react'; // Assuming PowerOff for check/fix, RefreshCw could be for logs
import { GalateaStatus as GalateaStatusType } from '@/hooks/useGalateaManager'; // Import type from hook

export interface GalateaDisplayBarProps {
  galateaStatus: GalateaStatusType;
  checkAndFixGalatea: () => void;
  refreshGalateaHealth: () => void; // For more targeted refresh
  // serverLogs?: string | null; // If we want to display logs or log refresh button here
  // refreshServerLogs?: () => void;
}

const GalateaDisplayBar: React.FC<GalateaDisplayBarProps> = ({
  galateaStatus,
  checkAndFixGalatea,
  refreshGalateaHealth,
  // serverLogs,
  // refreshServerLogs
}) => {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center h-auto px-2 text-xs text-muted-foreground rounded">
        <span
          className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${
            galateaStatus.serverRunning ? 'bg-green-600 animate-glow' : (galateaStatus.uploading ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400')
          }`}
          title={
            galateaStatus.uploading 
            ? 'Galatea Uploading...' 
            : galateaStatus.serverRunning 
            ? 'Galatea Running' 
            : 'Galatea Not Running'
          }
        />
        <span className="mr-1 shrink-0">Galatea</span>
        <span className="mr-1 shrink-0">-</span>
        <span className="mr-1 shrink-0">
          {galateaStatus.uploading 
            ? 'Uploading...' 
            : galateaStatus.serverRunning 
            ? 'Running' 
            : 'Not Running'}
        </span>
        {galateaStatus.serverRunning && galateaStatus.serverPort && (
          <>
            <span className="mr-1 shrink-0">-</span>
            <span className="truncate" title={`Port: ${galateaStatus.serverPort}`}>Port: {galateaStatus.serverPort}</span>
          </>
        )}
        {galateaStatus.error && !galateaStatus.serverRunning && (
          <>
            <span className="mr-1 shrink-0 text-red-400"> - Error: </span>
            <span className="truncate text-red-400" title={galateaStatus.error}>{galateaStatus.error.substring(0, 30)}{galateaStatus.error.length > 30 ? '...' : ''}</span>
          </>
        )}
        <div className="flex-grow"></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 ml-2"
              onClick={() => {
                // refreshGalateaHealth(); // This is good for a silent refresh
                checkAndFixGalatea(); // This provides user feedback and attempts fix
              }}
              disabled={galateaStatus.uploading} // Disable if currently uploading
            >
              {galateaStatus.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{galateaStatus.uploading ? "Galatea is processing..." : "Check/Fix Galatea Status"}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {galateaStatus.initialOutput && (
        <div className="flex items-start h-auto px-2 py-1 text-xs text-muted-foreground rounded border-t mt-1">
          <span className="mr-1 shrink-0 font-semibold">Initial Output:</span>
          <pre className="whitespace-pre-wrap text-xs flex-1 overflow-auto max-h-20">
            {galateaStatus.initialOutput}
          </pre>
        </div>
      )}
    </TooltipProvider>
  );
};

export default GalateaDisplayBar; 