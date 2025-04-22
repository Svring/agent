'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
// @ts-ignore: Missing type declarations for xterm
import { Terminal } from '@xterm/xterm';
// @ts-ignore: Missing type declarations for xterm-addon-fit
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

const DEFAULT_PATH = '/home/devbox'; // Default path, adjust if needed

export default function PropsPage() {
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
        setCurrentPath(DEFAULT_PATH);
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
  }, [getPrompt]); // Add dependencies for useCallback

  const handleCdCommand = useCallback((targetDir: string) => {
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
    newPath = newPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    // TODO: Ideally, verify path exists via a quick command?
    // For now, just update client state.
    setCurrentPath(newPath);
    currentTerm.write(getPrompt()); // Write new prompt immediately
  }, [getPrompt]); // Add dependencies for useCallback

  const executeCommand = useCallback(async (command: string) => {
    const currentTerm = termRef.current;
    if (!currentTerm) return;

    currentTerm.writeln(''); // Move to next line before showing output
    const fullCommand = `cd ${currentPathRef.current} && ${command}`; // Use ref here too

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


  // Effect 1: Check status on mount
  useEffect(() => {
    setIsMounted(true); // Indicate component has mounted
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/props', { method: 'GET' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.status === 'Connected') {
          setStatus('connected');
          setMessage('Connection is active.');
          setCurrentPath(DEFAULT_PATH); // Reset path on refresh if connected
        } else {
          setStatus('idle');
          setMessage('');
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setStatus('error');
        setMessage('Failed to check connection status.');
      }
    };
    checkStatus();
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
      rows: 20, // Set initial rows
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

    // Resize listener
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      // Consider if terminal should be disposed on unmount
      // term.dispose(); 
      // termRef.current = null; 
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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Props Manager SSH Terminal</h1>
      <div className="flex items-center space-x-4 mb-4">
        <Button 
          onClick={handleConnect} // Already defined above
          disabled={status === 'connecting' || status === 'connected'}
        >
          {status === 'connecting' ? 'Connecting...' : 
           status === 'connected' ? 'Connected' : 'Initialize SSH Connection'}
        </Button>
        <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
          Status: {status} {message && `- ${message}`}
        </p>
      </div>
      {/* Terminal container */}
      <div className="w-full h-96 bg-black rounded-md overflow-hidden shadow-md">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
      {status === 'error' && message && (
        <p className="mt-4 text-red-600">Error: {message}. Check server logs for details.</p>
      )}
    </div>
  );
}
