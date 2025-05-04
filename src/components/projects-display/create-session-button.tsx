'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createSessionForProject } from '@/db/actions/sessions-actions';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface CreateSessionButtonProps {
  projectId: string | number;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined;
  size?: "default" | "sm" | "lg" | "icon" | null | undefined;
  children?: React.ReactNode;
}

export function CreateSessionButton({
  projectId,
  className,
  variant = "outline",
  size = "sm",
  children = "Create Session",
}: CreateSessionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreateSession = async () => {
    setIsLoading(true);
    try {
      const newSession = await createSessionForProject(projectId);
      if (newSession) {
        toast.success('New session created!');
        router.push(`/projects/${projectId}/${newSession.id}`);
        // router.refresh(); // May not be needed if redirecting
      } else {
        toast.error('Failed to create session.');
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error('An error occurred while creating the session.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleCreateSession}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        children
      )}
    </Button>
  );
} 