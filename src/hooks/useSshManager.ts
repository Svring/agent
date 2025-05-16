import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Project, User } from '@/payload-types'; // Assuming these types are correct

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface SshStatus {
  connected: boolean;
  cwd: string | null;
}

interface SshData {
  status: 'Connected' | 'Disconnected';
  cwd: string | null;
  credentials?: any; // Keep original structure from page.tsx
}

export function useSshManager(
  currentUser: User | null,
  authLoading: boolean,
  projectDetails: Project | null
) {
  const [sshStatus, setSshStatus] = useState<SshStatus>({ connected: false, cwd: null });
  const [isConnectingSsh, setIsConnectingSsh] = useState(false); // For disconnect
  const [isInitializingSSH, setIsInitializingSSH] = useState(false); // For initial connect

  const userIdForProps = currentUser?.id?.toString();

  const { data: sshData, error: sshError, mutate: mutateSshStatus } = useSWR<SshData>(
    userIdForProps ? '/api/props' : null, // Only fetch if userId is available
    fetcher,
    { refreshInterval: 5000 }
  );

  useEffect(() => {
    if (sshData) {
      const newStatus: SshStatus = {
        connected: sshData.status === 'Connected',
        cwd: sshData.cwd,
      };
      if (newStatus.connected !== sshStatus.connected || newStatus.cwd !== sshStatus.cwd) {
        console.log("[useSshManager] SWR updating SSH status:", newStatus);
        setSshStatus(newStatus);
      }
    } else if (sshError) {
      console.error('[useSshManager] Error fetching SSH status via SWR:', sshError);
      if (sshStatus.connected) {
        console.log("[useSshManager] SWR error, setting SSH status to disconnected.");
        setSshStatus({ connected: false, cwd: null });
      }
    }
  }, [sshData, sshError, sshStatus.connected, sshStatus.cwd]);

  const handleSshToggle = useCallback(async (connect = true) => {
    if (!userIdForProps || authLoading) {
      toast.error(authLoading ? "Authenticating..." : "User ID not available for SSH actions.");
      return;
    }
    if ((connect && (isConnectingSsh || isInitializingSSH || sshStatus.connected)) || (!connect && isConnectingSsh)) {
      console.log(`[useSshManager] SSH toggle skipped. Connect: ${connect}, isConnecting: ${isConnectingSsh}, isInitializing: ${isInitializingSSH}, isConnected: ${sshStatus.connected}`);
      return;
    }

    const action = connect ? 'initialize' : 'disconnect';
    if (action === 'initialize') setIsInitializingSSH(true);
    else setIsConnectingSsh(true); // Used for disconnect operation
    
    console.log(`[useSshManager] SSH Toggling - Action: ${action} for user ${userIdForProps}`);

    try {
      let requestBody: any = { action };
      if (action === 'initialize') {
        if (projectDetails?.dev_address?.[0]) {
          const devEnv = projectDetails.dev_address[0];
          requestBody = { 
            ...requestBody, 
            host: devEnv.address, 
            port: devEnv.port, 
            username: devEnv.username, 
            password: devEnv.password 
          };
        } else {
          console.warn("[useSshManager] SSH initialize called without projectDetails.dev_address. Connection might fail or use defaults.");
          // If projectDetails are strictly required for initialization, handle appropriately
          // For now, proceeding allows backend to use defaults or fail if necessary.
        }
      }

      const response = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const newSshData = await mutateSshStatus(); // Re-fetch status after action
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || `SSH ${action} failed with status ${response.status}`);

      if (newSshData) {
        setSshStatus({ connected: newSshData.status === 'Connected', cwd: newSshData.cwd });
      }

      toast.success(`SSH ${action} successful.`);
      console.log(`[useSshManager] SSH ${action} successful for user ${userIdForProps}. New CWD: ${newSshData?.cwd}`);

    } catch (error) {
      toast.error(`Error during SSH ${action}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[useSshManager] Error during SSH ${action} for user ${userIdForProps}:`, error);
      // On error, ensure local state reflects that connection likely failed or is unchanged
      // Re-fetch or use existing data as fallback
      const currentSshData = sshData; 
      if (currentSshData) {
        setSshStatus({ connected: currentSshData.status === 'Connected' && action !== 'disconnect', cwd: currentSshData.cwd });
      } else {
        // If no prior data, assume disconnection on error
        setSshStatus({ connected: false, cwd: null });
      }
    } finally {
      if (action === 'initialize') setIsInitializingSSH(false);
      else setIsConnectingSsh(false);
      console.log(`[useSshManager] SSH Toggle Finished - Action: ${action}. Initializing: ${isInitializingSSH}, Connecting: ${isConnectingSsh}`);
    }
  }, [userIdForProps, authLoading, projectDetails, isConnectingSsh, isInitializingSSH, sshStatus.connected, mutateSshStatus, sshData]);

  useEffect(() => {
    // Attempt initial SSH connection only if all conditions are met
    if (userIdForProps && !authLoading && projectDetails && !sshStatus.connected && !isInitializingSSH && !isConnectingSsh) {
      console.log("[useSshManager] Attempting initial SSH connection with project details for user:", userIdForProps);
      // A small delay can sometimes help ensure other initializations (like projectDetails loading) are fully settled.
      const timer = setTimeout(() => {
        handleSshToggle(true); // Attempt to connect
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [userIdForProps, authLoading, projectDetails, sshStatus.connected, isInitializingSSH, isConnectingSsh, handleSshToggle]);

  return { 
    sshStatus, 
    isConnectingSsh, 
    isInitializingSSH, 
    handleSshToggle,
    mutateSshStatus // Expose mutate for external refresh if needed
  };
} 