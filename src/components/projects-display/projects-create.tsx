'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createProject } from '@/db/actions/projects-actions';
import { toast } from 'sonner';

export function ProjectCreateForm() {
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!projectName.trim()) {
      setError('Project name cannot be empty.');
      setIsLoading(false);
      return;
    }

    try {
      // Create the project - user association happens automatically in createProject
      const newProject = await createProject({
        name: projectName,
      });

      if (!newProject) {
        throw new Error('Failed to create project. Please try again.');
      }

      toast.success(`Project "${newProject.name}" created successfully!`);
      
      // Force a complete reload to refresh all server components
      window.location.href = '/projects';
    } catch (err: any) {
      console.error("Error creating project:", err);
      const errorMessage = err.message || 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg bg-card border">
      <CardHeader>
        <CardTitle>Create New Project</CardTitle>
        <CardDescription>Enter a name for your new project.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="projectName">Project Name</Label>
              <Input 
                id="projectName" 
                placeholder="My Awesome Project" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button 
            variant="outline" 
            onClick={() => router.push('/projects')} 
            type="button"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Project'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 