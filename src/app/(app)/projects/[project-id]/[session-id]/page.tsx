'use client';

import { useChat, type Message as VercelMessage } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useState, useEffect, useCallback } from 'react';
import React from 'react';
import MessageBubble from '@/components/message-display/message-bubble';
import Stage from '@/components/stage';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Hammer, Send, BrainCog, Power, PowerOff, Square, Bot, Eye, ClipboardCopy, User as UserIcon, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { useParams, useRouter } from 'next/navigation';

import useSWR from 'swr';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import { PlaywrightContext } from '@/context/PlaywrightContext';
import { CounterMessagesSchema, PlanStep } from '@/models/chatSchemas';
import { type Message } from '@/models/chatSchemas';
import { generateId } from 'ai';
import { getSessionMessagesForChat } from '@/db/actions/sessions-actions';
import { Project, User } from '@/payload-types';
import { getProjectById } from '@/db/actions/projects-actions';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SessionDetailPage() {
  const params = useParams<{ 'project-id': string, 'session-id': string }>();
  const { 'project-id': projectId, 'session-id': sessionId } = params;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const userIdForPlaywright = currentUser?.id?.toString();
  const userIdForProps = currentUser?.id?.toString();

  const [apiRoute, setApiRoute] = useState<string>('/api/opera/chat');
  const [initialMessages, setInitialMessages] = useState<VercelMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);
  const [isInitializingSSH, setIsInitializingSSH] = useState(false);
  const [showAllMessagesSheet, setShowAllMessagesSheet] = useState(false);

  const [browserStatus, setBrowserStatus] = useState<{ initialized: boolean, viewport: { width: number, height: number } | null, url: string | null }>({ initialized: false, viewport: null, url: null });
  const [isBrowserLoading, setIsBrowserLoading] = useState(false);

  const [sshStatus, setSshStatus] = useState<{ connected: boolean, cwd: string | null }>({ connected: false, cwd: null });
  const [isConnectingSsh, setIsConnectingSsh] = useState(false);

  const [galateaStatus, setGalateaStatus] = useState<{
    uploading: boolean;
    uploaded: boolean;
    error: string | null;
    serverRunning: boolean;
    serverPort: number | null;
    serverPid: number | null;
    serverUrl: string | null;
  }>({
    uploading: false,
    uploaded: false,
    error: null,
    serverRunning: false,
    serverPort: null,
    serverPid: null,
    serverUrl: null
  });

  // Add state for Galatea monitoring
  const [isGalateaMonitoring, setIsGalateaMonitoring] = useState(false);

  // Add SWR for polling server status
  const { data: serverStatusData, error: serverStatusError, mutate: refreshServerStatus } =
    useSWR(
      currentUser?.id ? `/api/language?serverStatus=true` : null,
      fetcher,
      { refreshInterval: 10000 } // Poll every 10 seconds
    );

  // Add SWR for polling server logs
  const { data: serverLogsData, error: serverLogsError, mutate: refreshServerLogs } =
    useSWR(
      currentUser?.id && galateaStatus.serverRunning ? `/api/language?serverLogs=true&lines=50` : null,
      fetcher,
      { refreshInterval: galateaStatus.serverRunning ? 5000 : 0 } // Poll every 5 seconds when server is running
    );

  // Update galateaStatus when server status changes
  useEffect(() => {
    if (serverStatusData?.serverInfo) {
      const serverInfo = serverStatusData.serverInfo;
      setGalateaStatus(prev => ({
        ...prev,
        serverRunning: serverInfo.status === 'running',
        serverPort: serverInfo.port || null,
        serverPid: serverInfo.pid || null,
        serverUrl: serverInfo.url || null
      }));
    }
  }, [serverStatusData]);

  // Add a new SWR hook for Galatea health
  const { data: galateaHealthData, error: galateaHealthError, mutate: refreshGalateaHealth } =
    useSWR(
      currentUser?.id ? `/api/language/galatea-health-check` : null,
      async (url) => {
        const response = await fetch('/api/language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkGalateaFunctioning'
          })
        });
        return response.json();
      },
      { refreshInterval: 15000 } // Poll every 15 seconds
    );

  // Use this health data to update Galatea status
  useEffect(() => {
    if (galateaHealthData) {
      setGalateaStatus(prev => ({
        ...prev,
        serverRunning: galateaHealthData.healthy || false,
        error: galateaHealthData.healthy ? null : (galateaHealthData.message || "Service not healthy")
      }));
    }
  }, [galateaHealthData]);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        setAuthLoading(true);
        const response = await fetch('/api/users/me');
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Authentication required. Redirecting to login...");
            router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
            setCurrentUser(null);
          } else {
            throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`);
          }
        } else {
          const userData: { user: User | null } = await response.json();
          if (userData.user) {
            setCurrentUser(userData.user);
            console.log("[SessionPage] Current user ID:", userData.user.id);
          } else {
            toast.error("No active user session. Redirecting to login...");
            router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error("[SessionPage] Error fetching current user:", error);
        toast.error(`Error fetching user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    fetchMe();
  }, [router]);

  useEffect(() => {
    if (projectId && currentUser?.id) {
      getProjectById(projectId)
        .then(data => {
          if (data) {
            setProjectDetails(data);

            // Set this project as active for the current user when project details load
            if (currentUser?.id && data.id) {
              console.log(`Setting active project ${data.id} for user ${currentUser.id} via API`);

              fetch('/api/language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'setActiveProject',
                  projectId: data.id.toString()
                })
              })
                .then(response => response.json())
                .then(result => {
                  if (result.success) {
                    console.log("Active project set successfully");
                  } else {
                    console.error("Failed to set active project:", result.message);
                  }
                })
                .catch(err => {
                  console.error("Error setting active project:", err);
                });
            }
          }
          else console.error("Project details not found for ID:", projectId);
        })
        .catch(err => console.error("Error fetching project details:", err));
    }
  }, [projectId, currentUser?.id]);

  const { messages, data, input, handleInputChange, handleSubmit, stop, status, setMessages, reload } = useChat({
    api: apiRoute,
    initialMessages: initialMessages,
    body: {
      projectId: projectId,
      sessionId: sessionId,
    },
    onFinish: async (message) => {
      if (apiRoute === '/api/opera/counterfeit') {
        if (Array.isArray(data) && data.length > 0) {
          const latestCounterfeitState = data[data.length - 1];
          const validationResult = CounterMessagesSchema.safeParse(latestCounterfeitState);
          if (validationResult.success) {
            console.log("[onFinish] Counterfeit API call finished. Setting messages to finalMessages from stream first.");
            setMessages(validationResult.data.finalMessages as VercelMessage[]);

            console.log("[onFinish] Now, reloading messages from DB after counterfeit call.");
            await reloadMessagesFromDb();
          } else {
            console.error("[onFinish] Counterfeit API call finished, but failed to parse finalMessages from the latest data chunk:", validationResult.error.flatten());
            await reloadMessagesFromDb();
          }
        } else {
          console.error("[onFinish] Counterfeit API call finished, but the 'data' array (from useChat) is empty or not an array. Reloading from DB as a fallback.");
          await reloadMessagesFromDb();
        }
      }
      await reloadMessagesFromDb();
    }
  });

  const reloadMessagesFromDb = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingMessages(true);
    try {
      const messagesFromDb = await getSessionMessagesForChat(sessionId);
      setMessages(messagesFromDb as VercelMessage[]);
    } catch (error) {
      console.error('Error reloading messages from DB:', error);
      toast.error("Failed to reload messages.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [sessionId, setMessages]);

  useEffect(() => {
    if (sessionId) reloadMessagesFromDb();
  }, [sessionId, reloadMessagesFromDb]);

  const { data: castingData, error: castingError } = useSWR<{
    models: { key: string, label: string }[];
    tools: { key: string, label: string }[];
  }>('/api/casting', fetcher);

  const { data: sshData, error: sshError, mutate: mutateSshStatus } = useSWR<{
    status: 'Connected' | 'Disconnected';
    cwd: string | null;
    credentials: any;
  }>('/api/props', fetcher, { refreshInterval: 5000 });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-7-sonnet-20250219');
  const [selectedTools, setSelectedTools] = useState<string[]>(['terminal', 'coder']);
  const [availableModels, setAvailableModels] = useState<{ key: string, label: string }[]>([]);
  const [availableTools, setAvailableTools] = useState<{ key: string, label: string }[]>([]);
  const [activeContextId, setActiveContextId] = useState<string>('opera');
  const [activePageId, setActivePageId] = useState<string | null>('main');

  const setActivePage = useCallback((contextId: string, pageId: string | null) => {
    setActiveContextId(contextId);
    setActivePageId(pageId);
  }, []);

  const toggleOpen = (key: string) => {
    setOpenStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExpandResult = (key: string) => {
    setExpandedResults(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      (messagesEndRef.current as HTMLElement).scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (castingData) {
      setAvailableModels(castingData.models || []);
      setAvailableTools(castingData.tools || []);
      if (!selectedModel && castingData.models && castingData.models.length > 0) {
        const defaultModelKey = castingData.models.find((m) => m.key === 'grok-3-latest')
          ? 'grok-3-latest'
          : castingData.models[0].key;
        setSelectedModel(defaultModelKey);
      }
    }
    if (castingError) {
      console.error('Error fetching casting options via SWR:', castingError);
    }
  }, [castingData, castingError, selectedModel]);

  useEffect(() => {
    if (sshData) {
      const newStatus = {
        connected: sshData.status === 'Connected',
        cwd: sshData.cwd
      };
      if (newStatus.connected !== sshStatus.connected || newStatus.cwd !== sshStatus.cwd) {
        console.log("SWR updating SSH status:", newStatus);
        setSshStatus(newStatus);
      }
    } else if (sshError) {
      console.error('Error fetching SSH status via SWR:', sshError);
      if (sshStatus.connected) {
        console.log("SWR error, setting SSH status to disconnected.");
        setSshStatus({ connected: false, cwd: null });
      }
    }
  }, [sshData, sshError]);

  const fetchBrowserStatus = useCallback(async () => {
    if (!userIdForPlaywright || authLoading) return;
    try {
      const statusRes = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getStatus' })
      });
      let initialized = false;
      let viewport = null;
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.success && statusData.status) {
          initialized = statusData.status.userContextExists;
          viewport = statusData.status.userViewport || null;
        }
      }
      setBrowserStatus({ initialized, viewport, url: null });
    } catch (error) {
      console.error('[SessionPage] Error fetching browser status:', error);
      setBrowserStatus({ initialized: false, viewport: null, url: null });
    }
  }, [userIdForPlaywright, authLoading]);

  const handleBrowserInit = async () => {
    if (!userIdForPlaywright || authLoading) {
      toast.error(authLoading ? "Authenticating..." : "User ID not available for browser init.");
      return;
    }
    setIsBrowserLoading(true);
    try {
      const width = browserStatus.viewport?.width || 1024;
      const height = browserStatus.viewport?.height || 768;
      await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init', width, height })
      });
      await fetchBrowserStatus();
      toast.success("Browser initialized for your session.");
    } catch (error) {
      toast.error("Failed to initialize browser.");
      console.error('[SessionPage] Error initializing browser:', error);
    } finally {
      setIsBrowserLoading(false);
    }
  };

  const handleBrowserCleanup = async () => {
    if (!userIdForPlaywright || authLoading) {
      toast.error(authLoading ? "Authenticating..." : "User ID not available for browser cleanup.");
      return;
    }
    setIsBrowserLoading(true);
    try {
      await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'closeUserContext' })
      });
      await fetchBrowserStatus();
      toast.info("Browser session closed.");
    } catch (error) {
      toast.error("Failed to close browser session.");
      console.error('[SessionPage] Error closing browser session:', error);
    } finally {
      setIsBrowserLoading(false);
    }
  };

  useEffect(() => {
    if (userIdForPlaywright && !authLoading && !browserStatus.initialized && !isBrowserLoading) {
      console.log("[SessionPage] Attempting initial browser initialization for user:", userIdForPlaywright);
      handleBrowserInit();
    }
    // Setup interval for status check regardless of initial state, clear on unmount
    if (userIdForPlaywright && !authLoading) {
      const intervalId = setInterval(fetchBrowserStatus, 5000);
      return () => clearInterval(intervalId);
    }
  }, [userIdForPlaywright, authLoading, browserStatus.initialized, isBrowserLoading, handleBrowserInit, fetchBrowserStatus]);

  const handleSshToggle = useCallback(async (connect = true) => {
    if (!userIdForProps || authLoading) {
      toast.error(authLoading ? "Authenticating..." : "User ID not available for SSH actions.");
      return;
    }
    if ((connect && (isConnectingSsh || isInitializingSSH || sshStatus.connected)) || (!connect && isConnectingSsh)) {
      console.log(`[SessionPage] SSH toggle skipped. Connect: ${connect}, isConnecting: ${isConnectingSsh}, isInitializing: ${isInitializingSSH}, isConnected: ${sshStatus.connected}`);
      return;
    }

    const action = connect ? 'initialize' : 'disconnect';
    if (action === 'initialize') setIsInitializingSSH(true); else setIsConnectingSsh(true);
    console.log(`[SessionPage] SSH Toggling - Action: ${action} for user ${userIdForProps}`);

    try {
      let requestBody: any = { action };
      if (action === 'initialize' && projectDetails?.dev_address?.[0]) {
        const devEnv = projectDetails.dev_address[0];
        requestBody = { ...requestBody, host: devEnv.address, port: devEnv.port, username: devEnv.username, password: devEnv.password };
      } else if (action === 'initialize') {
        // Fallback or error if projectDetails are not available for initialization
        console.warn("[SessionPage] SSH initialize called without projectDetails.dev_address. Connection might fail or use defaults.");
        // Potentially, you could disallow initialization here if projectDetails are strictly required.
        // For now, it proceeds, and the backend might use default credentials or fail.
      }

      const response = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      // It's crucial to await mutateSshStatus to get the latest status before making decisions
      const newSshData = await mutateSshStatus();
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || `SSH ${action} failed with status ${response.status}`);

      // Update local state based on the NEW data from mutateSshStatus or response
      // This ensures UI reflects the actual state post-operation
      if (newSshData) {
        setSshStatus({ connected: newSshData.status === 'Connected', cwd: newSshData.cwd });
      }

      toast.success(`SSH ${action} successful.`);
      console.log(`[SessionPage] SSH ${action} successful for user ${userIdForProps}. New CWD: ${newSshData?.cwd}`);

    } catch (error) {
      toast.error(`Error during SSH ${action}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[SessionPage] Error during SSH ${action} for user ${userIdForProps}:`, error);
      // On error, ensure local state reflects that connection likely failed or is unchanged
      const currentSshData = sshData; // Use existing swr data as fallback
      if (currentSshData) {
        setSshStatus({ connected: currentSshData.status === 'Connected' && action !== 'disconnect', cwd: currentSshData.cwd });
      }
    } finally {
      if (action === 'initialize') setIsInitializingSSH(false); else setIsConnectingSsh(false);
      console.log(`[SessionPage] SSH Toggle Finished - Action: ${action}. Initializing: ${isInitializingSSH}, Connecting: ${isConnectingSsh}`);
    }
  }, [userIdForProps, authLoading, projectDetails, isConnectingSsh, isInitializingSSH, sshStatus.connected, mutateSshStatus, sshData]);

  useEffect(() => {
    if (userIdForProps && !authLoading && projectDetails && !sshStatus.connected && !isInitializingSSH && !isConnectingSsh) {
      console.log("[SessionPage] Attempting initial SSH connection with project details for user:", userIdForProps);
      handleSshToggle(true);
    }
  }, [projectDetails, sshStatus.connected, userIdForProps, authLoading, isInitializingSSH, isConnectingSsh, handleSshToggle]);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  const handleApiToggle = async (newRoute: string) => {
    if (apiRoute === newRoute) return;

    console.log(`API route changing from ${apiRoute} to ${newRoute}`);

    if (status !== 'ready') {
      stop();
    }

    setMessages([]);
    setIsLoadingMessages(true);

    setApiRoute(newRoute);

    try {
      console.log(`Loading messages for session ${sessionId} after API route change to ${newRoute}`);
      const messagesFromDb = await getSessionMessagesForChat(sessionId);

      if (messagesFromDb && messagesFromDb.length > 0) {
        console.log(`Found ${messagesFromDb.length} messages for session ${sessionId}`);
        setMessages(messagesFromDb as VercelMessage[]);
      } else {
        console.log(`No messages found for session ${sessionId}`);
        setMessages([]);
      }
    } catch (error) {
      console.error(`Error loading messages after API change:`, error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const customHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading || !currentUser) {
      toast.error("Please wait, authenticating user...");
      return;
    }
    handleSubmit(e, {
      body: {
        messages: [{ id: generateId(), role: 'user', content: input, createdAt: new Date() } as VercelMessage],
        model: selectedModel,
        tools: selectedTools,
        projectId: projectId,
        sessionId: sessionId,
        customInfo: `The current user's id which is used for tool calls: ${currentUser.id} | ActivePage: ${activeContextId}/${activePageId || 'unknown'} | API: ${apiRoute}`
      }
    });
  };

  const validatedData = React.useMemo(() => {
    if (apiRoute === '/api/opera/counterfeit' && Array.isArray(data) && data.length > 0) {
      const latestCounterfeitState = data[data.length - 1];
      const validationResult = CounterMessagesSchema.safeParse(latestCounterfeitState);

      if (validationResult.success) {
        return { type: 'success' as const, data: validationResult.data };
      } else {
        console.error("Opera Page: Invalid counterfeit data received:", validationResult.error.flatten());
        return { type: 'error' as const, message: "Failed to process or display the latest plan due to invalid data." };
      }
    }
    return null;
  }, [data, apiRoute]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success(`${type} copied to clipboard!`);
      })
      .catch(err => {
        toast.error(`Failed to copy ${type}.`);
        console.error('Failed to copy to clipboard:', err);
      });
  };

  const messagesToRender = React.useMemo(() => {
    if (apiRoute === '/api/opera/counterfeit' && validatedData && validatedData.type === 'success') {
      console.log("[Counterfeit Render] Using validatedData.data.finalMessages");
      return validatedData.data.finalMessages as VercelMessage[];
    } else {
      console.log("[Chat Render/Fallback] Using messages from useChat hook");
      return messages;
    }
  }, [apiRoute, validatedData, messages]);

  // Add a new function to start Galatea monitoring
  const startGalateaMonitoring = useCallback(async () => {
    if (!currentUser?.id || !projectDetails?.id || !sshStatus.connected) {
      console.log("Cannot start Galatea monitoring: missing user, project details, or SSH connection");
      return;
    }

    try {
      setIsGalateaMonitoring(true);
      console.log("[SessionPage] Starting Galatea service monitoring for user:", currentUser.id);

      // First, configure the Next.js rewrite rule
      const configResult = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configureNextJsRewriteAndTestGalatea',
          galateaPort: 3051
        })
      }).then(r => r.json());

      if (configResult.configUpdated) {
        toast.info("Updated Next.js configuration for Galatea. The Next.js dev server on the remote machine needs to be restarted for changes to take effect.");
      }

      // Then start the monitoring service
      const response = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'monitorGalateaService',
          checkIntervalMs: 60000, // Check every minute
          maxRetries: 3
        })
      });

      const result = await response.json();

      if (result.success && result.monitoringStarted) {
        console.log("[SessionPage] Galatea service monitoring started successfully");
        toast.success("Galatea service monitoring started");
      } else {
        console.warn("[SessionPage] Failed to start Galatea service monitoring:", result.message);
        toast.error(`Failed to start Galatea monitoring: ${result.message}`);
        setIsGalateaMonitoring(false);
      }
    } catch (error) {
      console.error("[SessionPage] Error starting Galatea monitoring:", error);
      toast.error(`Error starting Galatea monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsGalateaMonitoring(false);
    }
  }, [currentUser?.id, projectDetails?.id, sshStatus.connected]);

  // Modify uploadAndStartGalatea to ensure proper sequencing with SSH
  const uploadAndStartGalatea = useCallback(async () => {
    if (!currentUser?.id || !projectDetails?.id) {
      console.log("Cannot upload Galatea: user or project details not available");
      return;
    }

    if (!sshStatus.connected) {
      console.log("Cannot upload Galatea: SSH not connected yet");
      return;
    }

    try {
      setGalateaStatus(prev => ({ ...prev, uploading: true, error: null }));

      const userId = currentUser.id.toString();
      const projectIdStr = projectDetails.id.toString();
      console.log(`Uploading and starting Galatea server for user ${userId} to project ${projectIdStr} via API`);

      // Wait briefly to ensure SSH connection is fully established
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadGalatea',
          projectId: projectIdStr,
          startServer: true,
          port: 3051, // Use fixed Galatea port
          args: [] // No arguments needed
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
          serverPort: result.serverInfo?.port || 3051, // Default to 3051 if not specified
          serverPid: result.serverInfo?.pid || null,
          serverUrl: result.serverInfo?.url || null
        }));

        // Refresh server status
        refreshServerStatus();

        if (result.serverStarted) {
          toast.success(`Galatea server started on port ${result.serverInfo?.port || 3051}`);

          // Start monitoring after successful launch
          if (!isGalateaMonitoring) {
            setTimeout(() => startGalateaMonitoring(), 3000);
          }
        } else if (!result.fileExists) {
          toast.success("Galatea binary uploaded successfully");
        }
      } else {
        setGalateaStatus(prev => ({
          ...prev,
          uploading: false,
          uploaded: false,
          error: result.message,
          serverRunning: false
        }));
        toast.error(`Failed to upload/start Galatea: ${result.message}`);
      }
    } catch (error) {
      console.error("Error uploading/starting Galatea:", error);
      setGalateaStatus(prev => ({
        ...prev,
        uploading: false,
        uploaded: false,
        error: error instanceof Error ? error.message : String(error),
        serverRunning: false
      }));
      toast.error(`Error with Galatea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [currentUser?.id, projectDetails?.id, refreshServerStatus, sshStatus.connected, isGalateaMonitoring, startGalateaMonitoring]);

  // Upload and start Galatea when SSH is connected - only once
  useEffect(() => {
    if (sshStatus.connected && !galateaStatus.uploading && !galateaStatus.uploaded && !galateaStatus.error && !galateaStatus.serverRunning) {
      // Delay to ensure SSH connection is fully established
      const timer = setTimeout(() => {
        uploadAndStartGalatea();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sshStatus.connected, galateaStatus, uploadAndStartGalatea]);

  // Add a function to check Galatea status and restart if needed
  const checkAndFixGalatea = useCallback(async () => {
    if (!currentUser?.id || !projectDetails?.id || !sshStatus.connected) {
      toast.error("Missing user, project, or SSH connection");
      return;
    }

    try {
      toast.info("Checking Galatea status...");

      const response = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkGalateaFunctioning'
        })
      });

      const result = await response.json();

      if (result.success) {
        if (result.healthy) {
          toast.success("Galatea is functioning correctly");
        } else {
          toast.warning(`Galatea is not healthy: ${result.message}`);

          if (confirm("Galatea is not functioning correctly. Would you like to attempt to restart it?")) {
            // First, try to stop any existing Galatea server
            const stopResponse = await fetch('/api/language', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'stopGalateaServer'
              })
            });

            // Wait for processes to terminate
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Then start a fresh instance
            await uploadAndStartGalatea();

            toast.success("Galatea restart initiated");
          }
        }
      } else {
        toast.error(`Failed to check Galatea status: ${result.message}`);
      }
    } catch (error) {
      console.error("Error checking Galatea status:", error);
      toast.error(`Error checking Galatea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [currentUser?.id, projectDetails?.id, sshStatus.connected, uploadAndStartGalatea]);

  // Add a function to directly check the galatea health endpoint
  const checkDirectGalateaHealth = useCallback(async () => {
    if (!projectDetails?.production_address) {
      toast.error("Production address not configured for project");
      return;
    }

    try {
      const prodUrl = projectDetails.production_address;
      const healthUrl = `${prodUrl.replace(/\/$/, '')}/galatea/api/health`;

      toast.info(`Checking Galatea health at ${healthUrl}...`);

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.text();
        toast.success(`Galatea health check succeeded! Status: ${response.status}, Response: ${data}`);
        // Update status
        setGalateaStatus(prev => ({
          ...prev,
          serverRunning: true,
          error: null
        }));
      } else {
        toast.error(`Galatea health check failed! Status: ${response.status}`);
        // Update status
        setGalateaStatus(prev => ({
          ...prev,
          serverRunning: false,
          error: `Health endpoint returned status ${response.status}`
        }));
      }
    } catch (error) {
      console.error("Error checking direct Galatea health:", error);
      toast.error(`Error checking direct Galatea health: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Update status
      setGalateaStatus(prev => ({
        ...prev,
        serverRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [projectDetails?.production_address]);

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Authenticating...</p></div>;
  }
  if (!currentUser) {
    return <div className="flex items-center justify-center h-screen"><UserIcon className="h-8 w-8 mr-2 text-red-500" /> <p>Authentication failed or no active session.</p></div>;
  }

  return (
    <TooltipProvider>
      <style jsx>{`
        .animate-glow {
          box-shadow: 0 0 2px #22c55e, 0 0 4px #22c55e;
        }
      `}</style>
      <PlaywrightContext.Provider value={{ contextId: activeContextId, pageId: activePageId, setActivePage }}>
        <ResizablePanelGroup
          direction="horizontal"
          className="w-full h-full rounded-lg"
        >
          <ResizablePanel defaultSize={30} minSize={30} maxSize={50}>
            <div className="h-full flex flex-col">
              <header className="flex items-center px-3 py-2 shrink-0">
                <SidebarTrigger />
                <p className="flex-1 text-lg font-serif text-center"> Opera </p>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowAllMessagesSheet(true)}
                      className="mr-1 h-7 w-7"
                    >
                      <Eye size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Raw Messages Data</p>
                  </TooltipContent>
                </Tooltip>

                <Toggle
                  pressed={apiRoute === '/api/opera/counterfeit'}
                  onPressedChange={(checked) => handleApiToggle(checked ? '/api/opera/counterfeit' : '/api/opera/chat')}
                  className="ml-auto cursor-pointer"
                >
                  <BrainCog color={apiRoute === '/api/opera/counterfeit' ? 'cyan' : 'white'} />
                </Toggle>
              </header>

              <div className="flex-1 overflow-auto w-full">
                <ScrollArea className="h-full w-full px-3 pb-2">
                  <div className="space-y-2 h-full w-full">
                    {isLoadingMessages ? (
                      <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground">Loading messages...</p>
                      </div>
                    ) : (
                      messagesToRender.map((m, index) => {
                        const isLastMessage = index === messagesToRender.length - 1;
                        let messageSpecificData: { plan: any[] } | undefined = undefined;
                        if (apiRoute === '/api/opera/counterfeit' &&
                          validatedData &&
                          validatedData.type === 'success' &&
                          isLastMessage &&
                          m.id === validatedData.data.finalMessages[validatedData.data.finalMessages.length - 1]?.id) {
                          messageSpecificData = { plan: validatedData.data.plan };
                        }

                        return (
                          <MessageBubble
                            key={m.id || `msg-${index}`}
                            m={m}
                            openStates={openStates}
                            expandedResults={expandedResults}
                            toggleOpen={toggleOpen}
                            toggleExpandResult={toggleExpandResult}
                            data={messageSpecificData}
                            apiRoute={apiRoute}
                            isLastMessage={isLastMessage}
                          />
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              <footer className="p-2 border-t shrink-0">
                <div className="flex w-full flex-col rounded-lg border shadow-sm">
                  <form onSubmit={customHandleSubmit} className="flex flex-col w-full bg-background rounded-lg p-2">
                    <Textarea
                      className="flex-1 resize-none border-0 px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-lg mb-2"
                      placeholder="What's on your mind?"
                      value={input}
                      onChange={handleInputChange}
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          customHandleSubmit(e);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2 items-center">
                        <Select value={selectedModel} onValueChange={handleModelChange}>
                          <SelectTrigger size='sm' className="w-auto h-8 text-xs px-2 focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map(model => (
                              <SelectItem className="text-xs" key={model.key} value={model.key}>{model.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <MultiSelect
                          label="Tools"
                          icon={Hammer}
                          options={availableTools.map(tool => ({ label: tool.label, value: tool.key }))}
                          selectedOptions={selectedTools}
                          setSelectedOptions={setSelectedTools}
                        />
                      </div>
                      <div className="flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {status !== 'ready' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={stop}
                                aria-label="Stop generating"
                              >
                                <Square />
                              </Button>
                            ) : (
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={!input.trim() || status !== 'ready'}
                                aria-label="Send message"
                              >
                                <Send />
                              </Button>
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {status !== 'ready' ? 'Stop Generating' : 'Send Message'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </form>
                  <div className="flex items-center h-auto px-2 text-xs text-muted-foreground rounded">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${sshStatus.connected ? 'bg-green-600 animate-glow' : 'bg-gray-400'}`}
                      title={sshStatus.connected ? 'SSH Connected' : 'SSH Disconnected'}
                    />
                    <span className="mr-1 shrink-0">SSH Terminal</span>
                    <span className="mr-1 shrink-0">-</span>
                    <span className="mr-1 shrink-0">{sshStatus.connected ? 'Connected' : 'Disconnected'}</span>
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
                          onClick={() => handleSshToggle()}
                          disabled={isConnectingSsh || isInitializingSSH}
                        >
                          {sshStatus.connected
                            ? <PowerOff />
                            : <Power />
                          }
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isInitializingSSH ? 'Initializing...' : isConnectingSsh ? 'Disconnecting...' : sshStatus.connected ? 'Disconnect SSH' : 'Connect SSH'}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Add Galatea status indicator */}
                  <div className="flex items-center h-auto px-2 text-xs text-muted-foreground rounded">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${galateaStatus.serverRunning ? 'bg-green-600 animate-glow' : 'bg-gray-400'}`}
                      title={galateaStatus.serverRunning ? 'Galatea Running' : 'Galatea Not Running'}
                    />
                    <span className="mr-1 shrink-0">Galatea</span>
                    <span className="mr-1 shrink-0">-</span>
                    <span className="mr-1 shrink-0">{galateaStatus.serverRunning ? 'Running' : 'Not Running'}</span>
                    {galateaStatus.serverPort && (
                      <>
                        <span className="mr-1 shrink-0">-</span>
                        <span className="truncate" title={`Port: ${galateaStatus.serverPort}`}>Port: {galateaStatus.serverPort}</span>
                      </>
                    )}
                    {galateaStatus.error && (
                      <>
                        <span className="mr-1 shrink-0 text-red-400"> - Error: </span>
                        <span className="truncate text-red-400" title={galateaStatus.error}>{galateaStatus.error.substring(0, 25)}...</span>
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
                            refreshGalateaHealth();
                            // Try both methods
                            checkDirectGalateaHealth();
                            checkAndFixGalatea();
                          }}
                        >
                          <PowerOff className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Check Galatea Status
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex items-center h-auto px-2 text-xs text-muted-foreground mb-2 rounded">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${browserStatus.initialized ? 'bg-green-600 animate-glow' : 'bg-gray-400'}`}
                      title={browserStatus.initialized ? 'Browser Initialized' : 'Browser Not Initialized'}
                    />
                    <span className="mr-1 shrink-0">Browser</span>
                    <span className="mr-1 shrink-0">-</span>
                    <span className="mr-1 shrink-0">{browserStatus.initialized ? 'Initialized' : 'Not Initialized'}</span>
                    {browserStatus.initialized && browserStatus.viewport && (
                      <>
                        <span className="mr-1 shrink-0">-</span>
                        <span className="truncate" title={`Viewport: ${browserStatus.viewport.width}x${browserStatus.viewport.height}`}>{browserStatus.viewport.width}×{browserStatus.viewport.height}</span>
                      </>
                    )}
                    <div className="flex-grow"></div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 ml-2"
                          onClick={browserStatus.initialized ? handleBrowserCleanup : handleBrowserInit}
                          disabled={isBrowserLoading}
                        >
                          {browserStatus.initialized
                            ? <PowerOff className="h-4 w-4" />
                            : <Power className="h-4 w-4" />
                          }
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isBrowserLoading ? (browserStatus.initialized ? 'Cleaning up...' : 'Initializing...') : (browserStatus.initialized ? 'Cleanup Browser' : 'Initialize Browser')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </footer>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-0.5 bg-muted transition-colors duration-200" />

          <ResizablePanel defaultSize={70}>
            <div className="h-full p-2">
              <Stage className="h-full w-full" />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </PlaywrightContext.Provider>

      <Sheet open={showAllMessagesSheet} onOpenChange={setShowAllMessagesSheet}>
        <SheetContent className="w-full p-4 sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col overflow-auto" side="right">
          <SheetHeader>
            <SheetTitle>All Messages Raw Data</SheetTitle>
            <SheetDescription>
              Below is the raw JSON data for all messages currently in the chat, and the latest `data` prop from `useChat` (if any).
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Messages Array ({messages.length} items):</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(messages, null, 2), 'Messages JSON')}
                    className="h-7 px-2 text-xs flex items-center gap-1"
                  >
                    <ClipboardCopy size={12} /> Copy JSON
                  </Button>
                </div>
                <pre
                  className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                >
                  {JSON.stringify(messages, null, 2)}
                </pre>
              </div>

              {(apiRoute === '/api/opera/counterfeit' && data && Array.isArray(data) && data.length > 0) && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Latest `data` prop (Counterfeit Plan):</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(data[data.length - 1], null, 2), 'Counterfeit Data JSON')}
                      className="h-7 px-2 text-xs flex items-center gap-1"
                    >
                      <ClipboardCopy size={12} /> Copy JSON
                    </Button>
                  </div>
                  <pre
                    className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
                    {JSON.stringify(data[data.length - 1], null, 2)}
                  </pre>
                </div>
              )}

              {(apiRoute !== '/api/opera/counterfeit' && data) && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">`data` prop (Non-Counterfeit):</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(data, null, 2), 'Data JSON')}
                      className="h-7 px-2 text-xs flex items-center gap-1"
                    >
                      <ClipboardCopy size={12} /> Copy JSON
                    </Button>
                  </div>
                  <pre
                    className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[60vh]"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="submit">Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}