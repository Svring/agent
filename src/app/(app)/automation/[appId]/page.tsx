'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Workflow, Plus, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { createChat } from '@/db/actions/ChatSessions';
import { deleteChat, createChat, listChats } from '@/tools/chat-store';

interface ApplicationDetails {
  application: {
    id: string;
    name: string;
    description: string;
  };
  chatSessions: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  workflows: Array<{
    id: string;
    name: string;
    description: string;
    createdAt: string;
  }>;
}

export default function ApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const [details, setDetails] = useState<ApplicationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  const fetchDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const appId = params.appId;
      if (typeof appId !== 'string' || isNaN(parseInt(appId))) {
        throw new Error('Invalid Application ID in URL.');
      }

      // Fetch application details
      const response = await fetch(`/api/applications?appId=${appId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch application details');
      }
      const data = await response.json();

      // Fetch chat sessions
      const chatSessions = await listChats();

      // Combine the data
      setDetails({
        ...data,
        chatSessions
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [params.appId]);

  const handleNewChat = async () => {
    const appIdParam = params.appId;
    if (typeof appIdParam !== 'string') {
      setError('Cannot create chat due to invalid application ID in URL.');
      return;
    }
    const appIdNumber = parseInt(appIdParam, 10);
    if (isNaN(appIdNumber)) {
      setError('Cannot create chat due to non-numeric application ID in URL.');
      return;
    }
    setIsCreatingChat(true);
    try {
      const newChatId = await createChat();
      if (newChatId) {
        router.push(`/automation/${params.appId}/chat/${newChatId}`);
      } else {
        setError('Failed to create chat session.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during chat creation');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!chatId || deletingChatId) return;

    setDeletingChatId(chatId);
    setError(null);

    try {
      const success = await deleteChat(chatId);

      if (success) {
        await fetchDetails();
      } else {
        setError('Failed to delete chat session.');
      }
    } catch (err) {
      console.error('Error deleting chat session:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during chat deletion');
    } finally {
      setDeletingChatId(null);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !details ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Application not found</p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold">{details.application.name}</h1>
            <p className="text-muted-foreground">{details.application.description}</p>
          </div>

          <div className="flex flex-col space-y-6">
            {/* Chat Sessions */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Chat Sessions
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNewChat}
                    disabled={isCreatingChat || isLoading}
                  >
                    {isCreatingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {details.chatSessions.length > 0 ? (
                  <div className="space-y-2">
                    {details.chatSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border hover:bg-muted transition-colors group">
                        <Link
                          href={`/automation/${params.appId}/chat/${session.name}`}
                          className="flex-1 truncate"
                        >
                          <div>
                            <h3 className="font-medium text-sm truncate group-hover:underline">{session.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              Created: {new Date(session.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteChat(session.id);
                          }}
                          disabled={deletingChatId === session.id}
                          aria-label="Delete chat session"
                        >
                          {deletingChatId === session.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No chat sessions found</p>
                )}
              </CardContent>
            </Card>

            {/* Workflows */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5" />
                    Workflows
                  </CardTitle>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/workflows/new?appId=${details.application.id}`}>
                      <Plus className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {details.workflows.length > 0 ? (
                  <div className="space-y-4">
                    {details.workflows.map((workflow) => (
                      <Link
                        key={workflow.id}
                        href={`/automation/${params.appId}/workflows/${workflow.id}`}
                        className="block p-4 rounded-lg border hover:bg-muted transition-colors"
                      >
                        <h3 className="font-medium">{workflow.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {workflow.description}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Created: {new Date(workflow.createdAt).toLocaleDateString()}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No workflows found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
