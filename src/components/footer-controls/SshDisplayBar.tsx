import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Power, PowerOff, Loader2 } from 'lucide-react';

interface SshStatus {
  connected: boolean;
  cwd: string | null;
}

export interface SshDisplayBarProps {
  sshStatus: SshStatus;
  isConnectingSsh: boolean;
  isInitializingSSH: boolean;
  handleSshToggle: (connect?: boolean) => void; // connect param is optional in original hook
}

const SshDisplayBar: React.FC<SshDisplayBarProps> = ({
  sshStatus,
  isConnectingSsh,
  isInitializingSSH,
  handleSshToggle,
}) => {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center h-auto px-2 text-xs text-muted-foreground rounded">
        <span
          className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${
            sshStatus.connected ? 'bg-green-600 animate-glow' : 'bg-gray-400'
          }`}
          title={sshStatus.connected ? 'SSH Connected' : 'SSH Disconnected'}
        />
        <span className="mr-1 shrink-0">SSH Terminal</span>
        <span className="mr-1 shrink-0">-</span>
        <span className="mr-1 shrink-0">
          {isInitializingSSH ? 'Initializing...' : isConnectingSsh ? 'Disconnecting...' : sshStatus.connected ? 'Connected' : 'Disconnected'}
        </span>
        {sshStatus.connected && sshStatus.cwd && (
          <>
            <span className="mr-1 shrink-0">-</span>
            <span className="truncate" title={sshStatus.cwd}>{sshStatus.cwd}</span>
          </>
        )}
        <div className="flex-grow"></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 ml-2"
              onClick={() => handleSshToggle(!sshStatus.connected)} // Pass explicit desire to connect/disconnect
              disabled={isConnectingSsh || isInitializingSSH}
            >
              {isInitializingSSH || isConnectingSsh ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sshStatus.connected ? (
                <PowerOff className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isInitializingSSH
                ? 'Initializing SSH...'
                : isConnectingSsh
                ? 'Disconnecting SSH...'
                : sshStatus.connected
                ? 'Disconnect SSH'
                : 'Connect SSH'}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default SshDisplayBar; 