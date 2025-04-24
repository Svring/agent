'use client'

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiFolder, FiFile, FiChevronUp } from 'react-icons/fi';
import { VscLoading } from 'react-icons/vsc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import Editor from '@monaco-editor/react';
import useSWR from 'swr';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

interface FileItem {
  name: string;
  isDirectory: boolean;
}

interface ApiStatusResponse {
  status: string;
  cwd: string | null;
  credentials: {
    host: string;
    username: string;
    port: number;
    privateKeyPath: string;
  };
}

const fetcher = async (url: string): Promise<ApiStatusResponse> => {
  const response = await axios.get(url);
  return response.data;
};

const fileListFetcher = async (url: string, cwd: string | null): Promise<FileItem[]> => {
  if (!cwd) return [];
  const response = await axios.post(url, {
    action: 'execute',
    command: `ls -l "${cwd}"`
  });
  if (response.data.stdout) {
    const lines = response.data.stdout.split('\n').filter((line: string) => line.trim() !== '');
    const startIndex = lines[0].startsWith('total ') ? 1 : 0;
    return lines.slice(startIndex).map((line: string) => {
      const parts = line.split(/	| +/);
      const name = parts.slice(8).join(' ');
      const isDirectory = line.startsWith('d');
      return { name, isDirectory };
    });
  } else {
    return [];
  }
};

const MiniExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use SWR for fetching connection status and CWD with automatic revalidation
  const { data: statusData, error: statusError, mutate: refreshStatus } = useSWR('/api/props', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const status = statusData ? (statusData.status as 'Connected' | 'Disconnected') : 'Loading';
  const cwd = statusData?.cwd || null;

  // Use SWR for fetching file list, dependent on cwd
  const { data: filesData, error: filesError, isLoading: isLoadingFiles, mutate: refreshFiles } = useSWR(
    status === 'Connected' && cwd ? ['/api/props', cwd] : null,
    ([url, cwd]) => fileListFetcher(url, cwd),
    {
      revalidateOnFocus: true,
    }
  );

  const files = filesData || [];

  // Handle errors from SWR
  useEffect(() => {
    if (statusError) {
      setError('Failed to fetch connection status');
    } else if (filesError) {
      setError('Failed to list files');
    } else {
      setError(null);
    }
  }, [statusError, filesError]);

  // Handle directory navigation
  const navigateToDirectory = async (dirName: string) => {
    if (!cwd) return;
    let newPath = dirName === '..' ? cwd.split('/').slice(0, -1).join('/') || '/' : `${cwd}/${dirName}`;
    if (newPath === '//') newPath = '/';
    try {
      const response = await axios.post('/api/props', {
        action: 'execute',
        command: `cd "${newPath}"`
      });
      if (response.data.message.includes('changed to')) {
        // Update local state and refresh data
        await refreshStatus();
        await refreshFiles();
      } else {
        setError('Failed to change directory');
      }
    } catch (err) {
      setError(`Failed to navigate: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Handle return to home directory
  const returnToHomeDirectory = async () => {
    try {
      const response = await axios.post('/api/props', {
        action: 'execute',
        command: 'cd'
      });
      if (response.data.message.includes('changed to')) {
        // Refresh data after navigation
        await refreshStatus();
        await refreshFiles();
      } else {
        setError('Failed to return to home directory');
      }
    } catch (err) {
      setError(`Failed to return to home: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Handle file click to open editor
  const handleFileClick = async (fileName: string) => {
    if (!cwd) return;
    const filePath = cwd === '/' ? `/${fileName}` : `${cwd}/${fileName}`;
    setSelectedFile(filePath);
    try {
      const response = await axios.post('/api/props', {
        action: 'readFile',
        filePath: filePath
      });
      if (response.data.content !== undefined) {
        setFileContent(response.data.content);
        setError(null);
      } else {
        setError('Failed to load file content');
      }
    } catch (err) {
      setError(`Failed to load file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Handle content change in editor
  const handleEditorChange = (value: string | undefined) => {
    setFileContent(value || '');
  };

  // Save modified content back to file
  const saveFileContent = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      const response = await axios.post('/api/props', {
        action: 'editFile',
        filePath: selectedFile,
        content: fileContent
      });
      if (response.data.message.includes('successfully')) {
        setSelectedFile(null);
        setFileContent('');
        setError(null);
      } else {
        setError('Failed to save file content');
      }
    } catch (err) {
      setError(`Failed to save file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-row h-full border-2 border-muted rounded-lg w-full bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" className="w-full h-full">
        {/* Sidebar - Explorer */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40} className="flex flex-col border-border h-full">
          <Card className="flex flex-col border-border h-full">
            <CardContent className="flex flex-col flex-1 py-4 px-2">
              <div className="mb-2 px-2 text-sm border-b border-border pb-2">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground truncate text-xs flex-1">{cwd || 'Not available'}</p>
                  {status === 'Connected' && (
                    <Button
                      onClick={returnToHomeDirectory}
                      size="sm"
                      variant="outline"
                      className="text-xs py-0.5 px-1"
                    >
                      Home
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 pt-2 px-2">
                {status !== 'Connected' ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">Please connect to view files</p>
                ) : isLoadingFiles ? (
                  <div className="flex justify-center items-center h-full"><VscLoading className="animate-spin text-2xl" /></div>
                ) : files.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">No files found in current directory</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {cwd && cwd !== '/' && (
                      <li
                        key="parent-dir"
                        className="flex items-center p-1 hover:bg-accent rounded cursor-pointer"
                        onClick={() => navigateToDirectory('..')}
                      >
                        <FiChevronUp className="text-primary mr-1" size={14} />
                        <span className="text-muted-foreground">..</span>
                      </li>
                    )}
                    {files.map((file) => (
                      <li
                        key={file.name}
                        className={`flex items-center p-1 rounded cursor-pointer ${selectedFile && selectedFile.endsWith(file.name) ? 'bg-accent' : 'hover:bg-accent'}`}
                        onClick={() => file.isDirectory ? navigateToDirectory(file.name) : handleFileClick(file.name)}
                      >
                        {file.isDirectory ? <FiFolder className="text-primary mr-1" size={14} /> : <FiFile className="text-muted-foreground mr-1" size={14} />}
                        <span className="truncate">{file.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </ResizablePanel>
        <ResizableHandle className="w-0.5" />
        {/* Editor Area */}
        <ResizablePanel defaultSize={67} minSize={50} className="flex flex-col bg-editor-background h-full border-border">
          {selectedFile ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-2 bg-editor-tab-background border-b border-border text-sm text-editor-foreground">
                <span className="font-medium truncate">{selectedFile.split('/').pop()}</span>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileContent('');
                    }}
                    className="text-xs py-0.5 px-1"
                  >
                    Close
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={saveFileContent}
                    disabled={isSaving}
                    className="text-xs py-0.5 px-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {isSaving ? <VscLoading className="animate-spin inline mr-1" /> : null}
                    Save
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="plaintext"
                  value={fileContent}
                  onChange={handleEditorChange}
                  options={{
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    fontSize: 14,
                    lineNumbers: 'on',
                    renderLineHighlight: 'gutter',
                    tabSize: 2,
                  }}
                  theme="vs-dark"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm bg-editor-background">
              <p>No file selected.</p>
              <p>Click on a file in the explorer to open it.</p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default MiniExplorer;
