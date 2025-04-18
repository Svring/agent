'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Workflow, Plus, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { deleteChat, createChat, listChats } from '@/tools/general/chat-store';
import { getAllWorkflows, createWorkflow, deleteWorkflow } from '@/db/actions/Workflows';
import { getApplicationById } from '@/db/actions/Applications';
import type { Workflow as WorkflowType, DefaultStep } from '@/tools/general/workflow-use/workflow-use-type';
import type { Application } from '@/payload-types';

// Types
interface ChatSession {
  id: string;
  name: string;
  createdAt: string;
}

interface ApplicationDetails {
  application: Application;
  chatSessions: ChatSession[];
  workflows: WorkflowType[];
}

// Utility Components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

const ErrorDisplay = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-4">
    <p className="text-destructive">{message}</p>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <p className="text-muted-foreground text-sm">{message}</p>
);

const ListItem = ({
  title,
  subtitle,
  date,
  href,
  onDelete,
  isDeleting,
}: {
  title: string;
  subtitle?: string;
  date: string;
  href: string;
  onDelete: () => void;
  isDeleting: boolean;
}) => (
  <div className="flex items-center justify-between gap-2 p-2 rounded-lg border hover:bg-muted transition-colors group">
    <Link href={href} className="flex-1 truncate">
      <h3 className="font-medium text-sm truncate group-hover:underline">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <p className="text-xs text-muted-foreground">Created: {new Date(date).toLocaleDateString()}</p>
    </Link>
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
      }}
      disabled={isDeleting}
      aria-label={`Delete ${title}`}
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  </div>
);

const WorkflowForm = ({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  error,
  isSubmitting,
}: {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  isSubmitting: boolean;
}) => (
  <form onSubmit={onSubmit} className="space-y-4 py-4">
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor="workflow-name" className="text-right">Name</Label>
      <Input
        id="workflow-name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="col-span-3"
        required
        disabled={isSubmitting}
      />
    </div>
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor="workflow-description" className="text-right">Description</Label>
      <Textarea
        id="workflow-description"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        className="col-span-3"
        placeholder="(Optional) Describe what this workflow does"
        disabled={isSubmitting}
      />
    </div>
    {error && <p className="text-sm text-destructive text-center col-span-4">{error}</p>}
    <SheetFooter>
      <SheetClose asChild>
        <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
      </SheetClose>
      <Button type="submit" disabled={isSubmitting || !name.trim()}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Creating...' : 'Create Workflow'}
      </Button>
    </SheetFooter>
  </form>
);

// Main Component
export default function Page() {
  const { appId } = useParams<{ appId: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<ApplicationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchDetails = async () => {
    setError(null);
    if (!details) setIsLoading(true);

    try {
      if (typeof appId !== 'string') throw new Error('Invalid Application ID in URL.');
      const appIdNumber = parseInt(appId, 10);
      if (isNaN(appIdNumber)) throw new Error('Application ID must be a number.');

      const [application, chatSessions, workflows] = await Promise.all([
        getApplicationById(appId),
        listChats(),
        getAllWorkflows(appIdNumber),
      ]);

      if (!application) throw new Error('Application not found.');

      setDetails({ application, chatSessions, workflows });
    } catch (err) {
      console.error('Error fetching details:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [appId]);

  const handleNewChat = async () => {
    if (typeof appId !== 'string') {
      setError('Invalid application ID.');
      return;
    }
    setIsCreatingChat(true);
    try {
      const newChatId = await createChat();
      if (newChatId) router.push(`/automation/${appId}/chat/${newChatId}`);
      else setError('Failed to create chat session.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (deletingChatId) return;
    setDeletingChatId(chatId);
    try {
      if (await deleteChat(chatId)) await fetchDetails();
      else setError('Failed to delete chat session.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeletingChatId(null);
    }
  };

  const handleCreateWorkflow = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (typeof appId !== 'string') {
      setCreateError('Invalid Application ID.');
      return;
    }
    setIsCreatingWorkflow(true);
    setCreateError(null);

    const appIdNumber = parseInt(appId, 10);
    if (!workflowName.trim()) setCreateError('Workflow name is required.');
    else if (isNaN(appIdNumber)) setCreateError('Application ID must be a number.');
    else {
      try {
        const defaultStep: DefaultStep = { action: 'screenshot', description: 'Initial screenshot step' };
        const workflowData = {
          name: workflowName.trim(),
          description: workflowDescription.trim() || null,
          application: appIdNumber,
          steps: [defaultStep],
          sequenceDescription: null,
        };

        if (await createWorkflow(workflowData)) {
          setIsSheetOpen(false);
          setWorkflowName('');
          setWorkflowDescription('');
          await fetchDetails();
        } else setCreateError('Failed to create workflow.');
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    }
    setIsCreatingWorkflow(false);
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (deletingWorkflowId) return;
    setDeletingWorkflowId(workflowId);
    try {
      if (await deleteWorkflow(workflowId)) await fetchDetails();
      else setError('Failed to delete workflow.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeletingWorkflowId(null);
    }
  };

  if (error) return <ErrorDisplay message={error} />;
  if (isLoading) return <LoadingSpinner />;
  if (!details) return <EmptyState message="Application not found" />;

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{details.application.name}</h1>
        <p className="text-muted-foreground">{details.application.description}</p>
      </header>

      <section className="space-y-6">
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
            {details.chatSessions.length ? (
              <div className="space-y-2">
                {details.chatSessions.map((session) => (
                  <ListItem
                    key={session.id}
                    title={session.name}
                    date={session.createdAt}
                    href={`/automation/${appId}/chat/${session.id}`}
                    onDelete={() => handleDeleteChat(session.id)}
                    isDeleting={deletingChatId === session.id}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No chat sessions found" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Workflows
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsSheetOpen(true)} disabled={isLoading}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {details.workflows.length ? (
              <div className="space-y-4">
                {details.workflows.map((workflow) => (
                  <ListItem
                    key={workflow.id}
                    title={workflow.name}
                    subtitle={workflow.description || 'No description provided'}
                    date={workflow.createdAt.toString()}
                    href={`/automation/${appId}/workflow/${workflow.id}`}
                    onDelete={() => handleDeleteWorkflow(workflow.id.toString())}
                    isDeleting={deletingWorkflowId === workflow.id.toString()}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No workflows found" />
            )}
          </CardContent>
        </Card>
      </section>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className='p-4'>
          <SheetHeader>
            <SheetTitle>Create New Workflow</SheetTitle>
            <SheetDescription>
              Enter a name and optional description. Starts with a screenshot step.
            </SheetDescription>
          </SheetHeader>
          <WorkflowForm
            name={workflowName}
            description={workflowDescription}
            onNameChange={setWorkflowName}
            onDescriptionChange={setWorkflowDescription}
            onSubmit={handleCreateWorkflow}
            error={createError}
            isSubmitting={isCreatingWorkflow}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}