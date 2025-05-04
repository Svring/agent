import React from 'react';
import { notFound } from 'next/navigation';
import { getProjectById } from '@/db/actions/projects-actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FolderGit2, Globe, Server, Calendar, FolderOpen, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CreateSessionButton } from '@/components/projects-display/create-session-button';

export default async function ProjectDetailPage({
  params,
}: {
  params: { 'project-id': string };
}) {
  const projectParams = await params;
  const projectId = projectParams['project-id'];
  const project = await getProjectById(projectId);

  if (!project) {
    notFound();
  }

  const { name, production_address, dev_address = [], sessions = [] } = project;
  const createdAt = project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'Unknown';
  const hasDevEnvironments = Array.isArray(dev_address) && dev_address.length > 0;
  const hasProductionAddress = !!production_address;
  const hasSessions = Array.isArray(sessions) && sessions.length > 0;

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Project Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <FolderGit2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{name}</h1>
            <p className="text-sm text-muted-foreground flex items-center mt-1">
              <Calendar className="h-3.5 w-3.5 mr-1" /> Created on {createdAt}
            </p>
          </div>
        </div>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Main Content */}
        <div className="md:col-span-8 space-y-6">
          {/* Production Environment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Production Environment
              </CardTitle>
              <CardDescription>The production deployment address for this project</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {hasProductionAddress ? (
                <div className="p-3 bg-card border rounded-md">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm">{production_address}</p>
                    <Badge variant="outline">Active</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No production environment configured for this project.</p>
              )}
            </CardContent>
          </Card>

          {/* Development Environments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Development Environments
              </CardTitle>
              <CardDescription>Dev and testing environments for this project</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {hasDevEnvironments ? (
                <div className="space-y-3">
                  {dev_address.map((env, index) => (
                    <div key={index} className="p-3 bg-card border rounded-md">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-sm">
                            {env.address}
                            {env.port ? `:${env.port}` : ''}
                          </p>
                          <Badge variant="outline">{index === 0 ? 'Primary' : `Dev ${index + 1}`}</Badge>
                        </div>
                        {(env.username || env.password) && (
                          <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-muted-foreground">
                            {env.username && (
                              <div>
                                <span className="font-semibold">Username:</span> {env.username}
                              </div>
                            )}
                            {env.password && (
                              <div>
                                <span className="font-semibold">Password:</span> ••••••••
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No development environments configured for this project.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="md:col-span-4 space-y-6">
          {/* Sessions Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                Sessions
              </CardTitle>
              <CardDescription>Work sessions for this project</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {hasSessions ? (
                <div className="space-y-2">
                  {Array.isArray(sessions) && sessions.slice(0, 5).map((session, index) => {
                    const sessionName = typeof session === 'object' && session !== null && session.name
                      ? session.name
                      : `Session ${index + 1}`;
                    const sessionId = typeof session === 'object' && session !== null && session.id
                      ? session.id
                      : session;
                      
                    return (
                      <Link href={`/projects/${projectId}/${sessionId}`} key={index}>
                        <div className="p-2 hover:bg-muted rounded-md transition-colors cursor-pointer flex items-center justify-between">
                          <span className="text-sm truncate">{sessionName}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {typeof session === 'object' && session !== null && session.createdAt
                              ? new Date(session.createdAt).toLocaleDateString()
                              : 'Unknown date'}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                  
                  {sessions.length > 5 && (
                    <div className="pt-2">
                      <Separator />
                      <div className="pt-2 text-center">
                        <Link href={`/projects/${projectId}/sessions`} className="text-xs text-primary hover:underline">
                          View all {sessions.length} sessions
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">No sessions found for this project.</p>
                  <CreateSessionButton projectId={projectId} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Create Session
                  </CreateSessionButton>
                </>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button variant="default" className="w-full">
              <Link href={`/projects/${projectId}/edit`} className="w-full flex items-center justify-center">
                Edit Project
              </Link>
            </Button>
            <CreateSessionButton projectId={projectId} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" /> New Session
            </CreateSessionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
