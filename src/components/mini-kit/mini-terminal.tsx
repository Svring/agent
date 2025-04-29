'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
// @ts-ignore: Missing type declarations for xterm
import { Terminal } from '@xterm/xterm';
// @ts-ignore: Missing type declarations for xterm-addon-fit
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import useSWR from 'swr';
import axios from 'axios';

const DEFAULT_PATH = '/home/devbox'; // Default path, adjust if needed

interface MiniTerminalProps {
  className?: string;
}

interface ApiStatusResponse {
  status: string;
  cwd: string | null;
}

const fetcher = async (url: string): Promise<ApiStatusResponse> => {
  const response = await axios.get(url);
  return response.data;
};

export const MiniTerminal: React.FC<MiniTerminalProps> = ({ className }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const statusRef = useRef(status); // Ref to hold current status
  const [message, setMessage] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>(DEFAULT_PATH);
  const currentPathRef = useRef(currentPath); // Ref for current path
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const commandBuffer = useRef<string>('');

  // Use SWR for fetching connection status and CWD with automatic revalidation
  const { data: statusData, error: statusError, mutate: refreshStatus } = useSWR('/api/props', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  // Update status and path based on SWR data
  useEffect(() => {
    if (statusData) {
      setStatus(statusData.status === 'Connected' ? 'connected' : 'idle');
      setMessage(statusData.status === 'Connected' ? 'Connection is active.' : '');
      if (statusData.cwd) {
        setCurrentPath(statusData.cwd);
      }
    } else if (statusError) {
      setStatus('error');
      setMessage('Failed to fetch connection status');
    }
  }, [statusData, statusError]);

  // Keep refs updated with the latest state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  const getPrompt = useCallback(() => `\r\n${currentPathRef.current}$ `, []); // Use ref in prompt callback

  // --- Command Handlers DEFINED BEFORE useEffect ---
  // Wrap command handlers in useCallback to stabilize their references if needed
  const handleConnect = useCallback(async () => {
    const currentTerm = termRef.current;
    if (!currentTerm) return;
    setStatus('connecting');
    setMessage('Attempting to connect...');
    currentTerm.writeln('\r\nAttempting SSH connection...');
    try {
      const response = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' }),
      });
      const data = await response.json();

      if (response.ok) {
        setStatus('connected');
        setMessage(data.message || 'Connection successful!');
        // Refresh status to get the latest CWD
        await refreshStatus();
        currentTerm.writeln('Connection established.');
      } else {
        setStatus('error');
        setMessage(data.message || 'Connection failed.');
        currentTerm.writeln(`Connection failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      setStatus('error');
      const errorMsg = error instanceof Error ? error.message : String(error);
      setMessage(`Connection request failed: ${errorMsg}`);
      console.error('Error calling /api/props:', error);
      currentTerm.writeln(`Connection error: ${errorMsg}`);
    } finally {
      currentTerm.write(getPrompt());
    }
  }, [getPrompt, refreshStatus]); // Add dependencies for useCallback

  const handleCdCommand = useCallback(async (targetDir: string) => {
    const currentTerm = termRef.current;
    if (!currentTerm) return;

    let newPath = '';
    const currentLocalPath = currentPathRef.current; // Use ref for calculation
    if (targetDir === '..') {
      const parts = currentLocalPath.split('/').filter(Boolean);
      if (parts.length > 0) parts.pop();
      newPath = '/' + parts.join('/');
    } else if (targetDir.startsWith('/')) {
      newPath = targetDir;
    } else if (targetDir === '~' || !targetDir) {
      newPath = DEFAULT_PATH; // Handle 'cd' or 'cd ~' 
    } else {
      newPath = (currentLocalPath === '/' ? '' : currentLocalPath) + '/' + targetDir;
    }

    // Basic path normalization (remove double slashes, trailing slash)
    newPath = newPath.replace(/\+/g, '/').replace(/\/$/, '') || '/';

    // Execute the cd command to update server state
    try {
      const response = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', command: `cd ${newPath}` }),
      });
      const data = await response.json();

      if (response.ok && data.message.includes('changed to')) {
        // Extract the new path from the message if possible, or use the calculated path
        const newCwdMatch = data.message.match(/changed to (.*)/);
        const newCwd = newCwdMatch ? newCwdMatch[1] : newPath;
        setCurrentPath(newCwd); // Update immediately to reflect in prompt
        // Refresh status to update the CWD in background
        await refreshStatus();
        currentTerm.writeln(`Changed directory to: ${newCwd}`);
      } else {
        currentTerm.writeln(`Failed to change directory: ${data.stderr || data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error changing directory:', error);
      currentTerm.writeln(`Error changing directory: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      currentTerm.write(getPrompt()); // Write new prompt immediately
    }
  }, [getPrompt, refreshStatus]); // Add dependencies for useCallback

  const executeCommand = useCallback(async (command: string) => {
    const currentTerm = termRef.current;
    if (!currentTerm) return;

    currentTerm.writeln(''); // Move to next line before showing output
    // Do not prepend 'cd' to every command since PropsManager maintains CWD
    const fullCommand = command;

    try {
      const response = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', command: fullCommand }),
      });
      const data = await response.json();

      if (response.ok) {
        if (data.stdout) {
          // Replace newlines for proper terminal display
          currentTerm.write(data.stdout.replace(/\n/g, '\r\n'));
        }
        if (data.stderr) {
          // Write stderr on a new line, perhaps with different color?
          currentTerm.write(`\r\nError: ${data.stderr.replace(/\n/g, '\r\n')}`);
        }
      } else {
        currentTerm.write(`\r\nCommand failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error executing command:', error);
      currentTerm.write(`\r\nCommand execution error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      currentTerm.write(getPrompt()); // Write prompt after command finishes
    }
  }, [getPrompt]); // Add dependencies for useCallback

  // Effect 1: Set mounted flag
  useEffect(() => {
    setIsMounted(true); // Indicate component has mounted
  }, []); // Run only once on mount

  // Effect 2: Initialize Terminal on mount
  useEffect(() => {
    if (!isMounted || !terminalRef.current || termRef.current) {
      return; // Don't initialize if not mounted, ref not ready, or already initialized
    }

    console.log("Initializing terminal...");
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
      },
      rows: 10, // Set initial rows for a smaller terminal, will be adjusted by fit
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    termRef.current = term;

    // Handle terminal input
    term.onKey(({ key, domEvent }: { key: string; domEvent: KeyboardEvent }) => {
      const currentTerm = termRef.current;
      if (!currentTerm) return;

      if (domEvent.key === 'Enter') {
        const command = commandBuffer.current.trim();
        commandBuffer.current = ''; // Clear buffer immediately

        if (command) {
          // Use the ref here to check the LATEST status
          if (statusRef.current === 'connected') {
            if (command.startsWith('cd ')) {
              const targetDir = command.substring(3).trim();
              handleCdCommand(targetDir); // Now defined above
            } else {
              executeCommand(command); // Now defined above
            }
          } else {
            currentTerm.write('\r\nError: Not connected. Please initialize the connection.');
            currentTerm.write(getPrompt());
          }
        } else {
          currentTerm.write(getPrompt()); // Write prompt even on empty command
        }
      } else if (domEvent.key === 'Backspace') {
        if (commandBuffer.current.length > 0) {
          commandBuffer.current = commandBuffer.current.slice(0, -1);
          currentTerm.write('\b \b');
        }
      } else if (!domEvent.ctrlKey && !domEvent.altKey && !domEvent.metaKey && domEvent.key.length === 1) {
        // Handle printable characters
        commandBuffer.current += domEvent.key;
        currentTerm.write(domEvent.key);
      }
    });

    // Resize listener to ensure terminal fills container on window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    // Initial resize after a brief delay to ensure DOM is fully rendered
    const resizeTimeout = setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
    // Dependencies include command handlers because onKey references them
  }, [isMounted, getPrompt, handleCdCommand, executeCommand]);

  // Effect 3: Write initial message to terminal based on status
  useEffect(() => {
    const currentTerm = termRef.current;
    if (currentTerm && isMounted) { // Ensure terminal exists and component is mounted
      currentTerm.writeln(''); // Clear or start fresh line
      if (status === 'connected') {
        currentTerm.writeln('Connection is active.');
      } else if (status === 'idle') {
        currentTerm.writeln('SSH Terminal Emulator (Initialize connection to start)');
      } else if (status === 'error') {
        currentTerm.writeln(`Error: ${message}`);
      }
      currentTerm.write(getPrompt()); // Write prompt based on current state
    }
    // Only re-run if these specific states change after mount
  }, [status, isMounted, getPrompt, message]);


  // --- Render --- 
  return (
    <div className={`flex flex-col p-2 h-full bg-background rounded-md overflow-hidden shadow-md ${className || ''}`}>
      <div className="flex items-center justify-between mb-2 px-2 py-1 bg-secondary rounded-md">
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleConnect} // Already defined above
            disabled={status === 'connecting' || status === 'connected'}
            size="sm"
            variant="outline"
            className="text-xs py-0.5 px-1"
          >
            {status === 'connecting' ? 'Connecting...' :
              status === 'connected' ? 'Connected' : 'Connect'}
          </Button>
          <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
            Status: {status} {message && `- ${message}`}
          </p>
        </div>
        <span className="text-xs text-foreground truncate">{currentPath}</span>
      </div>
      {/* Terminal container */}
      <div className="flex-1 w-full h-full bg-background overflow-hidden">
        <div ref={terminalRef} className="w-full h-full rounded-md overflow-hidden" />
      </div>
    </div>
  );
};

export default MiniTerminal;
