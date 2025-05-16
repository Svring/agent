import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Project, User } from '@/payload-types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface GalateaServerInfo {
  userId?: string;
  pid?: number;
  port?: number;
  url?: string;
  startTime?: Date | string;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'not_found'; // Added not_found
  lastError?: string;
  initialOutput?: string;
  message?: string; // Added from page.tsx serverInfo usage
}

export interface GalateaStatus {
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
  serverRunning: boolean;
  serverPort: number | null;
  serverPid: number | null;
  serverUrl: string | null;
  initialOutput?: string;
}

interface GalateaHealthData {
  success: boolean;
  message: string;
  healthy: boolean;
  logs?: string;
}

interface ServerStatusData {
  success: boolean;
  serverInfo: GalateaServerInfo | null;
  message?: string;
}

interface ServerLogsData {
  success: boolean;
  logs: string | null;
  message?: string;
}

export function useGalateaManager(
  currentUser: User | null,
  projectDetails: Project | null,
  sshConnected: boolean // Directly pass the boolean status
) {
  const [galateaStatus, setGalateaStatus] = useState<GalateaStatus>({
    uploading: false,
    uploaded: false,
    error: null,
    serverRunning: false,
    serverPort: null,
    serverPid: null,
    serverUrl: null,
    initialOutput: undefined,
  });
  const [isGalateaMonitoring, setIsGalateaMonitoring] = useState(false);

  const userId = currentUser?.id?.toString();
  const projectIdStr = projectDetails?.id?.toString();

  const { 
    data: serverStatusData, 
    error: serverStatusError, 
    mutate: refreshServerStatus 
  } = useSWR<ServerStatusData>(
    userId ? `/api/language?serverStatus=true` : null,
    fetcher,
    { refreshInterval: 10000 } // Poll every 10 seconds
  );

  const { 
    data: serverLogsData, 
    error: serverLogsError, 
    mutate: refreshServerLogs 
  } = useSWR<ServerLogsData>(
    // Poll only if user is logged in AND galatea server is believed to be running
    userId && galateaStatus.serverRunning ? `/api/language?serverLogs=true&lines=50` : null,
    fetcher,
    { refreshInterval: galateaStatus.serverRunning ? 5000 : 0 } 
  );

  useEffect(() => {
    if (serverStatusData?.serverInfo) {
      const serverInfo = serverStatusData.serverInfo;
      console.log("[useGalateaManager] Received server status data:", serverInfo);
      setGalateaStatus(prev => ({
        ...prev,
        serverRunning: serverInfo.status === 'running',
        serverPort: serverInfo.port || null,
        serverPid: serverInfo.pid || null,
        serverUrl: serverInfo.url || null,
        initialOutput: serverInfo.initialOutput || prev.initialOutput,
        error: serverInfo.status === 'error' ? (serverInfo.lastError || serverInfo.message || 'Unknown server error') : prev.error
      }));
    } else if (serverStatusError) {
        console.error("[useGalateaManager] Error fetching server status:", serverStatusError);
        // Optionally set an error state or assume server is not running
        setGalateaStatus(prev => ({ ...prev, serverRunning: false, error: "Failed to fetch server status."}));
    }
  }, [serverStatusData, serverStatusError]);


  const { 
    data: galateaHealthData, 
    error: galateaHealthError, 
    mutate: refreshGalateaHealth 
  } = useSWR<GalateaHealthData>(
    userId ? 'galateaHealthCheck' : null, // SWR key, actual fetch is custom
    async () => {
      if (!userId) throw new Error("User not available for Galatea health check");
      const response = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkGalateaFunctioning'
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        throw new Error(errorData.message || `Failed to check Galatea health: ${response.statusText}`);
      }
      return response.json();
    },
    { refreshInterval: 15000 } // Poll every 15 seconds
  );

  useEffect(() => {
    if (galateaHealthData) {
      console.log("[useGalateaManager] Received Galatea health data:", galateaHealthData);
      setGalateaStatus(prev => ({
        ...prev,
        serverRunning: galateaHealthData.healthy || false,
        error: galateaHealthData.healthy ? null : (galateaHealthData.message || "Service not healthy")
      }));
    } else if (galateaHealthError) {
        console.error("[useGalateaManager] Error fetching Galatea health:", galateaHealthError);
        setGalateaStatus(prev => ({ ...prev, serverRunning: false, error: galateaHealthError.message || "Failed to fetch Galatea health."}));
    }
  }, [galateaHealthData, galateaHealthError]);

  const startGalateaMonitoring = useCallback(async () => {
    if (!userId || !projectIdStr || !sshConnected) {
      console.log("[useGalateaManager] Cannot start Galatea monitoring: missing user, project details, or SSH connection");
      return;
    }

    try {
      setIsGalateaMonitoring(true);
      console.log("[useGalateaManager] Starting Galatea service monitoring for user:", userId);

      const response = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'monitorGalateaService',
          checkIntervalMs: 60000, 
          maxRetries: 3
        })
      });
      const result = await response.json();

      if (result.success && result.monitoringStarted) {
        console.log("[useGalateaManager] Galatea service monitoring started successfully");
        toast.success("Galatea service monitoring started");
      } else {
        console.warn("[useGalateaManager] Failed to start Galatea service monitoring:", result.message);
        toast.error(`Failed to start Galatea monitoring: ${result.message}`);
        setIsGalateaMonitoring(false);
      }
    } catch (error) {
      console.error("[useGalateaManager] Error starting Galatea monitoring:", error);
      toast.error(`Error starting Galatea monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsGalateaMonitoring(false);
    }
  }, [userId, projectIdStr, sshConnected]);

  const uploadAndStartGalatea = useCallback(async (isRetryAttempt = false) => {
    if (!userId || !projectIdStr) {
      console.log("[useGalateaManager] Cannot upload Galatea: user or project details not available");
      return;
    }
    if (!sshConnected) {
      console.log("[useGalateaManager] Cannot upload Galatea: SSH not connected yet");
      return;
    }

    try {
      setGalateaStatus(prev => ({ ...prev, uploading: true, error: null }));
      console.log(`${isRetryAttempt ? '[Retry] ' : ''}[useGalateaManager] Uploading and starting Galatea server for user ${userId} to project ${projectIdStr} via API`);

      if (!isRetryAttempt) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadGalatea',
          projectId: projectIdStr,
          startServer: true,
          port: 3051,
          args: []
        })
      });
      const result = await response.json();

      if (result.success) {
        setGalateaStatus(prev => ({
          ...prev,
          uploading: false,
          uploaded: true,
          error: null,
          serverRunning: result.serverStarted || false,
          serverPort: result.serverInfo?.port || 3051,
          serverPid: result.serverInfo?.pid || null,
          serverUrl: result.serverInfo?.url || null,
          initialOutput: result.serverInfo?.initialOutput || undefined
        }));
        refreshServerStatus(); // Refresh SWR polling for server status

        if (result.serverStarted) {
          toast.success(`Galatea server started on port ${result.serverInfo?.port || 3051}`);
          if (!isGalateaMonitoring) {
            setTimeout(() => startGalateaMonitoring(), 3000);
          }
        } else {
          const failureMessage = `Galatea binary ready, but server failed to start: ${result.message || 'Unknown reason'}`;
          toast.info(failureMessage);
          if (!isRetryAttempt) {
            console.log("[useGalateaManager] Galatea server failed initial start. Attempting forceful restart.");
            toast.info("Attempting a more forceful restart of Galatea server...");
            setTimeout(async () => {
              try {
                await fetch('/api/language', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'stopGalateaServer' })
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
                await uploadAndStartGalatea(true); // Retry
              } catch (retryError) {
                const retryErrorMsg = retryError instanceof Error ? retryError.message : String(retryError);
                toast.error(`Error during Galatea restart attempt: ${retryErrorMsg}`);
                setGalateaStatus(prev => ({ ...prev, uploading: false, error: `Retry failed: ${retryErrorMsg}` }));
              }
            }, 3000);
          } else {
            console.error("[useGalateaManager] Galatea server failed to start even after a retry.", result);
            toast.error(`Galatea server failed to start after retry: ${result.message || 'Unknown reason'}`);
            setGalateaStatus(prev => ({ ...prev, uploading: false, error: `Server failed after retry: ${result.message || 'Unknown reason'}` }));
          }
        }
      } else {
        const errorMessage = `Failed to upload/start Galatea: ${result.message || 'Network or server error'}`;
        console.error("[useGalateaManager] Galatea API call failed directly.", result);
        setGalateaStatus(prev => ({
          ...prev,
          uploading: false,
          uploaded: result.fileExists || false, 
          error: result.message || 'Network or server error',
          serverRunning: false
        }));
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[useGalateaManager] Error in uploadAndStartGalatea function:", error);
      setGalateaStatus(prev => ({
        ...prev,
        uploading: false,
        uploaded: false,
        error: errorMsg,
        serverRunning: false
      }));
      toast.error(`Error with Galatea operation: ${errorMsg}`);
    }
  }, [userId, projectIdStr, sshConnected, refreshServerStatus, isGalateaMonitoring, startGalateaMonitoring]);

  useEffect(() => {
    if (sshConnected && !galateaStatus.uploading && !galateaStatus.uploaded && !galateaStatus.error && !galateaStatus.serverRunning) {
      const timer = setTimeout(() => {
        uploadAndStartGalatea(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [sshConnected, galateaStatus.uploading, galateaStatus.uploaded, galateaStatus.error, galateaStatus.serverRunning, uploadAndStartGalatea]);

  const checkAndFixGalatea = useCallback(async () => {
    if (!userId || !projectIdStr || !sshConnected) {
      toast.error("Missing user, project, or SSH connection for Galatea check/fix");
      return;
    }
    try {
      toast.info("Checking Galatea status...");
      // Use the SWR mutate function for health check, which will also update galateaHealthData
      const result = await refreshGalateaHealth(); 

      if (result && result.success) {
        if (result.healthy) {
          toast.success("Galatea is functioning correctly");
        } else {
          toast.warning(`Galatea is not healthy: ${result.message}`);
          toast.promise(
            (async () => {
              await fetch('/api/language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stopGalateaServer' })
              });
              await new Promise(resolve => setTimeout(resolve, 3000));
              return uploadAndStartGalatea(); // No need for isRetry true here, it's handled inside
            })(),
            {
              loading: 'Restarting Galatea...',
              success: 'Galatea restart initiated',
              error: 'Failed to restart Galatea'
            }
          );
        }
      } else {
        toast.error(`Failed to check Galatea status: ${result?.message || 'Manual check returned no result'}`);
      }
    } catch (error) {
      console.error("[useGalateaManager] Error checking/fixing Galatea status:", error);
      toast.error(`Error checking Galatea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [userId, projectIdStr, sshConnected, uploadAndStartGalatea, refreshGalateaHealth]);

  // Automated status checking and recovery effect
  useEffect(() => {
    if (!userId || !sshConnected || !galateaStatus.serverRunning) {
      return; 
    }
    console.log("[useGalateaManager] Starting automated Galatea health check interval");
    const intervalId = setInterval(async () => {
      console.log("[useGalateaManager] Running automated Galatea health check");
      try {
        // This re-triggers the SWR hook for health data
        const healthResult = await refreshGalateaHealth(); 
        if (healthResult && healthResult.success && !healthResult.healthy) {
          console.log("[useGalateaManager] Automated check: Galatea unhealthy, attempting recovery");
          toast.warning("Galatea service is unhealthy. Attempting automated recovery...");
          await fetch('/api/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stopGalateaServer' })
          });
          await new Promise(resolve => setTimeout(resolve, 3000));
          await uploadAndStartGalatea(); // isRetry will be false by default
        }
      } catch (error) {
        console.error("[useGalateaManager] Error in automated Galatea health check:", error);
      }
    }, 60000); // Check every 60 seconds (adjust as needed)
    
    return () => {
      console.log("[useGalateaManager] Clearing Galatea health check interval");
      clearInterval(intervalId);
    };
  }, [userId, sshConnected, galateaStatus.serverRunning, uploadAndStartGalatea, refreshGalateaHealth]);

  return {
    galateaStatus,
    isGalateaMonitoring,
    serverLogs: serverLogsData?.logs || null, // Provide logs directly
    uploadAndStartGalatea,
    startGalateaMonitoring,
    checkAndFixGalatea,
    refreshGalateaHealth, // For manual trigger from UI
    refreshServerStatus, // For manual trigger from UI
    refreshServerLogs // For manual trigger from UI
  };
} 