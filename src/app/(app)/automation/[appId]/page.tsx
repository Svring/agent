'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Workflow, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createChat } from '@/db/actions/ChatSessions';

interface ApplicationDetails {
  application: {
    id: string;
    name: string;
    description: string;
  };
  chatSessions: Array<{
    id: string;
    title: string;
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

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(`/api/applications?appId=${params.appId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch application details');
        }
        const data = await response.json();
        setDetails(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [params.appId]);

  const handleNewChat = async () => {
    const appIdParam = params.appId;

    if (typeof appIdParam !== 'string') {
      console.error('Invalid appId from params:', appIdParam);
      setError('Cannot create chat due to invalid application ID in URL.');
      return;
    }

    const appIdNumber = parseInt(appIdParam, 10);

    if (isNaN(appIdNumber)) {
      console.error('Failed to parse appId to number:', appIdParam);
      setError('Cannot create chat due to non-numeric application ID in URL.');
      return;
    }

    setIsCreatingChat(true);
    try {
      const newChatId = await createChat(appIdNumber);
      
      if (newChatId) {
        router.push(`/automation/${params.appId}/chat/${newChatId}`);
      } else {
        console.error('Failed to create chat session or get ID.');
        setError('Failed to create chat session.');
      }
    } catch (err) {
      console.error('Error creating chat session:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during chat creation');
    } finally {
      setIsCreatingChat(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error || 'Application not found'}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
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
                disabled={isCreatingChat}
              >
                {isCreatingChat ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {details.chatSessions.length > 0 ? (
              <div className="space-y-4">
                {details.chatSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/automation/${params.appId}/chat/${session.id}`}
                    className="block p-4 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <h3 className="font-medium">{session.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No chat sessions found</p>
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
    </div>
  );
}
